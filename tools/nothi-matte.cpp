// nothi-matte: runs a person/object matting ONNX model on raw RGB frames.
// Reads frames (rgb24, W x H) on stdin, writes the alpha (gray8, W x H) of each frame on stdout.
// Uses the GPU when it can (DirectML on Windows, Core ML on macOS), else the CPU.
//
//   nothi-matte --model m.onnx --w 1280 --h 720 [--size 1024] [--ep auto|cpu|gpu] [--threads N]
//   nothi-matte --model m.onnx --probe            (prints the engine in use and the time of one frame)
//
// Part of Nothi Toolkit (https://nothilabs.com). Uses ONNX Runtime (MIT).
#include <onnxruntime_cxx_api.h>
#ifdef NM_DML
#include <dml_provider_factory.h>
#endif
#ifdef NM_COREML
#include <coreml_provider_factory.h>
#endif
#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <memory>
#include <string>
#include <vector>
#ifdef _WIN32
#include <fcntl.h>
#include <io.h>
#include <windows.h>
#endif

static void say(const char *s) { fprintf(stderr, "%s\n", s); fflush(stderr); }

static bool readAll(void *p, size_t n) {
  unsigned char *b = (unsigned char *)p; size_t got = 0;
  while (got < n) { size_t r = fread(b + got, 1, n - got, stdin); if (r == 0) return false; got += r; }
  return true;
}

// bilinear resize of an interleaved 8-bit image (c channels) into planar floats with ImageNet normalisation
static bool g_half = false; // MODNet-style input: (x - 0.5) / 0.5 instead of ImageNet mean/std
static void toTensor(const unsigned char *src, int w, int h, float *dst, int S, int T) {
  static const float mean[3] = {0.485f, 0.456f, 0.406f}, stdv[3] = {0.229f, 0.224f, 0.225f};
  const size_t plane = (size_t)S * T;
  for (int y = 0; y < T; y++) {
    float fy = (y + 0.5f) * h / T - 0.5f; if (fy < 0) fy = 0; int y0 = (int)fy; int y1 = std::min(y0 + 1, h - 1); float ay = fy - y0;
    for (int x = 0; x < S; x++) {
      float fx = (x + 0.5f) * w / S - 0.5f; if (fx < 0) fx = 0; int x0 = (int)fx; int x1 = std::min(x0 + 1, w - 1); float ax = fx - x0;
      for (int c = 0; c < 3; c++) {
        float a = src[((size_t)y0 * w + x0) * 3 + c], b = src[((size_t)y0 * w + x1) * 3 + c];
        float d = src[((size_t)y1 * w + x0) * 3 + c], e = src[((size_t)y1 * w + x1) * 3 + c];
        float v = (a + (b - a) * ax) * (1 - ay) + (d + (e - d) * ax) * ay;
        dst[c * plane + (size_t)y * S + x] = g_half ? (v / 127.5f - 1.f) : (v / 255.f - mean[c]) / stdv[c];
      }
    }
  }
}

static void fromAlpha(const float *a, int S, int T, bool logits, unsigned char *out, int w, int h) {
  for (int y = 0; y < h; y++) {
    float fy = (y + 0.5f) * T / h - 0.5f; if (fy < 0) fy = 0; int y0 = (int)fy; int y1 = std::min(y0 + 1, T - 1); float ay = fy - y0;
    for (int x = 0; x < w; x++) {
      float fx = (x + 0.5f) * S / w - 0.5f; if (fx < 0) fx = 0; int x0 = (int)fx; int x1 = std::min(x0 + 1, S - 1); float ax = fx - x0;
      float p = a[(size_t)y0 * S + x0], q = a[(size_t)y0 * S + x1], r = a[(size_t)y1 * S + x0], s = a[(size_t)y1 * S + x1];
      float v = (p + (q - p) * ax) * (1 - ay) + (r + (s - r) * ax) * ay;
      if (logits) v = 1.f / (1.f + std::exp(-v));
      int k = (int)std::lround(v * 255.f); out[(size_t)y * w + x] = (unsigned char)(k < 0 ? 0 : k > 255 ? 255 : k);
    }
  }
}

struct Engine {
  Ort::Env env{ORT_LOGGING_LEVEL_ERROR, "nothi-matte"};
  std::unique_ptr<Ort::Session> sess;
  std::string inName, outName, ep = "cpu";
  int S = 1024, T = 1024; bool fixed = false;
  bool open(const ORTCHAR_T *model, const std::string &want, int threads) {
    std::vector<std::string> order;
    if (want == "cpu") order = {"cpu"}; else order = {"gpu", "cpu"};
    for (auto &e : order) {
      try {
        Ort::SessionOptions o;
        o.SetGraphOptimizationLevel(GraphOptimizationLevel::ORT_ENABLE_ALL);
        if (threads > 0) o.SetIntraOpNumThreads(threads);
        bool gpu = false;
        if (e == "gpu") {
#if defined(NM_DML)
          o.DisableMemPattern(); o.SetExecutionMode(ExecutionMode::ORT_SEQUENTIAL);
          Ort::ThrowOnError(OrtSessionOptionsAppendExecutionProvider_DML(o, 0)); gpu = true; ep = "directml";
#elif defined(NM_COREML)
          Ort::ThrowOnError(OrtSessionOptionsAppendExecutionProvider_CoreML(o, 0)); gpu = true; ep = "coreml";
#else
          continue;
#endif
        }
        if (!gpu) ep = "cpu";
        sess.reset(new Ort::Session(env, model, o));
        Ort::AllocatorWithDefaultOptions al;
        inName = sess->GetInputNameAllocated(0, al).get();
        outName = sess->GetOutputNameAllocated(0, al).get();
        auto shape = sess->GetInputTypeInfo(0).GetTensorTypeAndShapeInfo().GetShape();
        if (shape.size() == 4 && shape[2] > 0 && shape[3] > 0) { T = (int)shape[2]; S = (int)shape[3]; fixed = true; }
        return true;
      } catch (const std::exception &x) {
        fprintf(stderr, "engine %s failed: %s\n", e.c_str(), x.what());
      }
    }
    return false;
  }
  // returns false if the run failed
  bool run(const unsigned char *rgb, int w, int h, unsigned char *alpha) {
    std::vector<float> in((size_t)3 * S * T);
    toTensor(rgb, w, h, in.data(), S, T);
    int64_t dims[4] = {1, 3, T, S};
    Ort::MemoryInfo mi = Ort::MemoryInfo::CreateCpu(OrtArenaAllocator, OrtMemTypeDefault);
    Ort::Value t = Ort::Value::CreateTensor<float>(mi, in.data(), in.size(), dims, 4);
    const char *ins[1] = {inName.c_str()}, *outs[1] = {outName.c_str()};
    auto r = sess->Run(Ort::RunOptions{nullptr}, ins, &t, 1, outs, 1);
    auto info = r[0].GetTensorTypeAndShapeInfo(); auto sh = info.GetShape();
    int oT = sh.size() >= 2 ? (int)sh[sh.size() - 2] : T, oS = sh.size() >= 1 ? (int)sh[sh.size() - 1] : S;
    const float *a = r[0].GetTensorData<float>(); size_t n = (size_t)oS * oT;
    float lo = 1e9f, hi = -1e9f; for (size_t i = 0; i < n; i++) { lo = std::min(lo, a[i]); hi = std::max(hi, a[i]); }
    bool logits = lo < -0.01f || hi > 1.01f;
    fromAlpha(a, oS, oT, logits, alpha, w, h);
    return true;
  }
};

#ifdef _WIN32
static std::string narrow(const wchar_t *w) { int n = WideCharToMultiByte(CP_UTF8, 0, w, -1, 0, 0, 0, 0); std::string s(n > 0 ? n - 1 : 0, '\0'); if (n > 1) WideCharToMultiByte(CP_UTF8, 0, w, -1, &s[0], n, 0, 0); return s; }
int wmain(int argc, wchar_t **wargv) {
  _setmode(_fileno(stdin), _O_BINARY); _setmode(_fileno(stdout), _O_BINARY);
  std::vector<std::string> args; for (int i = 0; i < argc; i++) args.push_back(narrow(wargv[i]));
  std::wstring model;
#else
int main(int argc, char **argv) {
  std::vector<std::string> args(argv, argv + argc);
  std::string model;
#endif
  int w = 0, h = 0, threads = 0, size = 0; std::string ep = "auto"; bool probe = false;
  for (int i = 1; i < argc; i++) {
    const std::string &a = args[i]; auto next = [&]() -> std::string { return i + 1 < argc ? args[++i] : std::string(); };
    if (a == "--model") {
#ifdef _WIN32
      model = (i + 1 < argc) ? std::wstring(wargv[i + 1]) : L""; i++;
#else
      model = next();
#endif
    } else if (a == "--w") w = atoi(next().c_str());
    else if (a == "--h") h = atoi(next().c_str());
    else if (a == "--size") size = atoi(next().c_str());
    else if (a == "--threads") threads = atoi(next().c_str());
    else if (a == "--ep") ep = next();
    else if (a == "--probe") probe = true;
    else if (a == "--norm") g_half = next() == "half";
    else if (a == "--version") { say("nothi-matte 1.0"); return 0; }
  }
  if (model.empty()) { say("usage: nothi-matte --model m.onnx --w W --h H"); return 2; }
  Engine E;
  if (!E.open(model.c_str(), ep, threads)) { say("ERROR could not load the model"); return 3; }
  if (size > 0 && !E.fixed) { E.S = size; E.T = size; }
  if (probe) { w = w ? w : 640; h = h ? h : 360; }
  if (!probe && ep == "auto" && E.ep != "cpu" && w > 0 && h > 0) {
    std::vector<unsigned char> t1((size_t)w * h * 3, 128), t2((size_t)w * h);
    auto timeIt = [&](Engine &X) { double best = 1e18; for (int k = 0; k < 2; k++) { auto t0 = std::chrono::steady_clock::now(); X.run(t1.data(), w, h, t2.data()); best = std::min(best, std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - t0).count()); } return best; };
    double g = 1e18, c = 1e18;
    try { g = timeIt(E); } catch (const std::exception &x) { fprintf(stderr, "gpu test failed: %s\n", x.what()); }
    Engine C;
    if (C.open(model.c_str(), "cpu", threads)) { if (size > 0 && !C.fixed) { C.S = size; C.T = size; } try { c = timeIt(C); } catch (...) {} }
    fprintf(stderr, "BENCH gpu=%.0f cpu=%.0f\n", g, c);
    if (c < g * 0.9 || g >= 1e17) { if (!E.open(model.c_str(), "cpu", threads)) return 3; if (size > 0 && !E.fixed) { E.S = size; E.T = size; } }
  }
  if (w <= 0 || h <= 0) { say("ERROR missing --w/--h"); return 2; }
  std::vector<unsigned char> rgb((size_t)w * h * 3), alpha((size_t)w * h);
  if (probe) {
    for (size_t i = 0; i < rgb.size(); i++) rgb[i] = (unsigned char)(i * 7);
    for (int k = 0; k < 2; k++) {
      auto t0 = std::chrono::steady_clock::now();
      try { E.run(rgb.data(), w, h, alpha.data()); } catch (const std::exception &x) {
        fprintf(stderr, "run on %s failed: %s\n", E.ep.c_str(), x.what());
        if (E.ep == "cpu" || !E.open(model.c_str(), "cpu", threads)) return 4;
        k--; continue;
      }
      double ms = std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - t0).count();
      fprintf(stderr, "PROBE ep=%s size=%dx%d ms=%.0f\n", E.ep.c_str(), E.S, E.T, ms);
    }
    return 0;
  }
  fprintf(stderr, "READY ep=%s size=%dx%d\n", E.ep.c_str(), E.S, E.T); fflush(stderr);
  while (readAll(rgb.data(), rgb.size())) {
    try { E.run(rgb.data(), w, h, alpha.data()); }
    catch (const std::exception &x) {
      // a GPU that fails mid-way: fall back to the CPU once and redo this frame
      fprintf(stderr, "run on %s failed: %s\n", E.ep.c_str(), x.what());
      if (E.ep == "cpu" || !E.open(model.c_str(), "cpu", threads)) { say("ERROR inference failed"); return 4; }
      if (size > 0 && !E.fixed) { E.S = size; E.T = size; }
      fprintf(stderr, "READY ep=%s size=%dx%d\n", E.ep.c_str(), E.S, E.T); fflush(stderr);
      try { E.run(rgb.data(), w, h, alpha.data()); } catch (const std::exception &y) { fprintf(stderr, "ERROR %s\n", y.what()); return 4; }
    }
    if (fwrite(alpha.data(), 1, alpha.size(), stdout) != alpha.size()) return 5;
    fflush(stdout);
  }
  return 0;
}

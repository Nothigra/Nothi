// nothi-matte: runs a person/object matting ONNX model on raw RGB frames.
// Reads frames (rgb24, W x H) on stdin, writes the alpha (gray8, W x H) of each frame on stdout.
// Uses the GPU when it can (DirectML on Windows, Core ML on macOS), else the CPU.
//
//   nothi-matte --model m.onnx --w 1280 --h 720 [--size 1024] [--ep auto|cpu|gpu] [--threads N]
//   nothi-matte --model m.onnx --probe            (prints the engine in use and the time of one frame)
//   nothi-matte --task face --model yunet.onnx --w W --h H
//        faces: reads rgb24 frames, writes one text line per frame on stdout:
//        "F score x y w h  x1 y1 ... x5 y5" (the face kept, 5 points: eyes, nose, mouth corners) or "F 0"
//   --lowmem   less memory (no arena, basic graph optimisation, processor only). Used by itself when a load fails.
//
// Part of Nothi Toolkit (https://nothilabs.com). Uses ONNX Runtime (MIT).
#ifdef __MINGW32__
// MinGW build: the ONNX Runtime headers use MSVC-only annotations, make them empty
#include <sal.h>
#ifndef _stdcall
#define _stdcall __stdcall
#endif
#ifndef _Check_return_
#define _Check_return_
#endif
#ifndef _Frees_ptr_opt_
#define _Frees_ptr_opt_
#endif
#ifndef _In_
#define _In_
#endif
#ifndef _In_opt_
#define _In_opt_
#endif
#ifndef _In_opt_z_
#define _In_opt_z_
#endif
#ifndef _In_z_
#define _In_z_
#endif
#ifndef _Inout_
#define _Inout_
#endif
#ifndef _Inout_opt_
#define _Inout_opt_
#endif
#ifndef _Out_
#define _Out_
#endif
#ifndef _Out_opt_
#define _Out_opt_
#endif
#ifndef _Outptr_
#define _Outptr_
#endif
#ifndef _Outptr_result_maybenull_
#define _Outptr_result_maybenull_
#endif
#ifndef _Ret_maybenull_
#define _Ret_maybenull_
#endif
#ifndef _Ret_notnull_
#define _Ret_notnull_
#endif
#ifndef _In_reads_
#define _In_reads_(...)
#endif
#ifndef _Inout_updates_
#define _Inout_updates_(...)
#endif
#ifndef _Inout_updates_all_
#define _Inout_updates_all_(...)
#endif
#ifndef _Out_writes_
#define _Out_writes_(...)
#endif
#ifndef _Out_writes_all_
#define _Out_writes_all_(...)
#endif
#ifndef _Out_writes_bytes_all_
#define _Out_writes_bytes_all_(...)
#endif
#ifndef _Outptr_result_buffer_maybenull_
#define _Outptr_result_buffer_maybenull_(...)
#endif
#ifndef _Return_type_success_
#define _Return_type_success_(...)
#endif
#ifndef _Success_
#define _Success_(...)
#endif
#endif
#include <onnxruntime_cxx_api.h>
#ifdef NM_DML
// declared here instead of dml_provider_factory.h (that header pulls in d3d12/DirectML headers we don't need)
extern "C" OrtStatus *ORT_API_CALL OrtSessionOptionsAppendExecutionProvider_DML(OrtSessionOptions *options, int device_id);
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
  std::vector<std::string> outNames;
  int S = 1024, T = 1024; bool fixed = false;
  bool lowmem = false;
  bool open(const ORTCHAR_T *model, const std::string &want, int threads) {
    std::vector<std::string> order;
    if (want == "cpu" || lowmem) order = {"cpu"}; else order = {"gpu", "cpu"};
    for (auto &e : order) {
      try {
        sess.reset(); // the old session goes first: two big models at once can run out of memory
        Ort::SessionOptions o;
        o.SetGraphOptimizationLevel(lowmem ? GraphOptimizationLevel::ORT_ENABLE_BASIC : GraphOptimizationLevel::ORT_ENABLE_ALL);
        if (lowmem) { o.DisableCpuMemArena(); o.DisableMemPattern(); }
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
        outNames.clear(); for (size_t k = 0; k < sess->GetOutputCount(); k++) outNames.push_back(sess->GetOutputNameAllocated(k, al).get());
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
  // ── faces (YuNet): BGR 0-255, letterboxed into the model's square; returns the face kept as a text line
  float px = -1, py = -1; // centre of the face kept on the previous frame
  std::string face(const unsigned char *rgb, int w, int h) {
    const float k = std::min((float)S / w, (float)T / h); const int nw = std::max(1, (int)(w * k)), nh = std::max(1, (int)(h * k));
    std::vector<float> in((size_t)3 * S * T, 0.f); const size_t plane = (size_t)S * T;
    for (int y = 0; y < nh; y++) {
      float fy = (y + 0.5f) / k - 0.5f; if (fy < 0) fy = 0; int y0 = std::min((int)fy, h - 1), y1 = std::min(y0 + 1, h - 1); float ay = fy - y0;
      for (int x = 0; x < nw; x++) {
        float fx = (x + 0.5f) / k - 0.5f; if (fx < 0) fx = 0; int x0 = std::min((int)fx, w - 1), x1 = std::min(x0 + 1, w - 1); float ax = fx - x0;
        for (int c = 0; c < 3; c++) {
          float a = rgb[((size_t)y0 * w + x0) * 3 + c], b = rgb[((size_t)y0 * w + x1) * 3 + c], d = rgb[((size_t)y1 * w + x0) * 3 + c], e = rgb[((size_t)y1 * w + x1) * 3 + c];
          in[(2 - c) * plane + (size_t)y * S + x] = (a + (b - a) * ax) * (1 - ay) + (d + (e - d) * ax) * ay; // RGB → BGR
        }
      }
    }
    int64_t dims[4] = {1, 3, T, S};
    Ort::MemoryInfo mi = Ort::MemoryInfo::CreateCpu(OrtArenaAllocator, OrtMemTypeDefault);
    Ort::Value t = Ort::Value::CreateTensor<float>(mi, in.data(), in.size(), dims, 4);
    std::vector<const char *> outs; for (auto &n : outNames) outs.push_back(n.c_str());
    const char *ins[1] = {inName.c_str()};
    auto r = sess->Run(Ort::RunOptions{nullptr}, ins, &t, 1, outs.data(), outs.size());
    auto find = [&](const std::string &n) -> const float * { for (size_t q = 0; q < outNames.size(); q++) if (outNames[q] == n) return r[q].GetTensorData<float>(); return nullptr; };
    struct F { float s, x, y, w, h, p[10]; }; std::vector<F> all;
    for (int st : {8, 16, 32}) {
      const float *cls = find("cls_" + std::to_string(st)), *obj = find("obj_" + std::to_string(st)), *bb = find("bbox_" + std::to_string(st)), *kp = find("kps_" + std::to_string(st));
      if (!cls || !obj || !bb || !kp) continue;
      const int cols = S / st, rows = T / st;
      for (int ry = 0; ry < rows; ry++) for (int cx = 0; cx < cols; cx++) {
        const int i = ry * cols + cx;
        float cs = std::min(1.f, std::max(0.f, cls[i])), os = std::min(1.f, std::max(0.f, obj[i])), sc = std::sqrt(cs * os);
        if (sc < 0.5f) continue;
        F f; f.s = sc;
        float ccx = (cx + bb[i * 4]) * st, ccy = (ry + bb[i * 4 + 1]) * st, ww = std::exp(bb[i * 4 + 2]) * st, hh = std::exp(bb[i * 4 + 3]) * st;
        f.x = (ccx - ww / 2) / k; f.y = (ccy - hh / 2) / k; f.w = ww / k; f.h = hh / k;
        for (int n = 0; n < 5; n++) { f.p[n * 2] = (kp[i * 10 + n * 2] + cx) * st / k; f.p[n * 2 + 1] = (kp[i * 10 + n * 2 + 1] + ry) * st / k; }
        all.push_back(f);
      }
    }
    if (all.empty()) return "F 0";
    // keep the face that goes on from the last frame (else the most confident and biggest)
    int best = 0; float bv = -1e30f;
    for (size_t q = 0; q < all.size(); q++) {
      const F &f = all[q]; float v = f.s * 2 + std::log(1 + f.w * f.h) * 0.25f;
      if (px >= 0) { float dx = f.x + f.w / 2 - px, dy = f.y + f.h / 2 - py, dd = std::sqrt(dx * dx + dy * dy) / std::max(1.f, f.w); v -= dd * 3; }
      if (v > bv) { bv = v; best = (int)q; }
    }
    // the box: average of the boxes that overlap the chosen one (steadier than a single anchor)
    F a = all[best]; double sw = 0; F m = {0, 0, 0, 0, 0, {0}};
    for (auto &f : all) {
      float ix = std::max(0.f, std::min(a.x + a.w, f.x + f.w) - std::max(a.x, f.x)), iy = std::max(0.f, std::min(a.y + a.h, f.y + f.h) - std::max(a.y, f.y));
      float iou = ix * iy / (a.w * a.h + f.w * f.h - ix * iy + 1e-6f); if (iou < 0.4f) continue;
      float wt = f.s * f.s; sw += wt; m.s = std::max(m.s, f.s); m.x += f.x * wt; m.y += f.y * wt; m.w += f.w * wt; m.h += f.h * wt; for (int n = 0; n < 10; n++) m.p[n] += f.p[n] * wt;
    }
    m.x /= sw; m.y /= sw; m.w /= sw; m.h /= sw; for (int n = 0; n < 10; n++) m.p[n] /= sw;
    px = m.x + m.w / 2; py = m.y + m.h / 2;
    char buf[512]; int o = snprintf(buf, sizeof buf, "F %.3f %.2f %.2f %.2f %.2f", m.s, m.x, m.y, m.w, m.h);
    for (int n = 0; n < 10; n++) o += snprintf(buf + o, sizeof buf - o, " %.2f", m.p[n]);
    return buf;
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
  int w = 0, h = 0, threads = 0, size = 0; std::string ep = "auto", task = "matte"; bool probe = false, lowmem = false;
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
    else if (a == "--task") task = next();
    else if (a == "--lowmem") lowmem = true;
    else if (a == "--version") { say("nothi-matte 1.0"); return 0; }
  }
  if (model.empty()) { say("usage: nothi-matte --model m.onnx --w W --h H"); return 2; }
  Engine E; E.lowmem = lowmem;
  if (!E.open(model.c_str(), ep, threads)) {
    // not enough memory (or no graphics card): once more, light on memory, on the processor
    if (lowmem) { say("ERROR could not load the model"); return 3; }
    say("LOWMEM retry"); E.lowmem = lowmem = true;
    if (!E.open(model.c_str(), "cpu", threads)) { say("ERROR could not load the model"); return 3; }
  }
  if (task == "face") {
    if (w <= 0 || h <= 0) { say("ERROR missing --w/--h"); return 2; }
    std::vector<unsigned char> rgb((size_t)w * h * 3);
    fprintf(stderr, "READY ep=%s size=%dx%d\n", E.ep.c_str(), E.S, E.T); fflush(stderr);
    while (readAll(rgb.data(), rgb.size())) {
      std::string line;
      try { line = E.face(rgb.data(), w, h); } catch (const std::exception &x) {
        fprintf(stderr, "run on %s failed: %s\n", E.ep.c_str(), x.what());
        if (E.ep == "cpu" || !E.open(model.c_str(), "cpu", threads)) { say("ERROR inference failed"); return 4; }
        try { line = E.face(rgb.data(), w, h); } catch (const std::exception &y) { fprintf(stderr, "ERROR %s\n", y.what()); return 4; }
      }
      fprintf(stdout, "%s\n", line.c_str()); fflush(stdout);
    }
    return 0;
  }
  if (size > 0 && !E.fixed) { E.S = size; E.T = size; }
  if (probe) { w = w ? w : 640; h = h ? h : 360; }
  if (!probe && !lowmem && ep == "auto" && E.ep != "cpu" && w > 0 && h > 0) {
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

// nothi-voice: isolates the voice of a stereo track with Demucs v4 (demucs.cpp, MIT).
//   nothi-voice <model.bin> <in.f32> <out_voice.f32> [threads]
// in/out: raw 32-bit float, stereo interleaved, 44100 Hz. Progress lines "P 0.42" on stderr.
// Part of Nothi Toolkit (https://nothilabs.com).
#include "model.hpp"
#include "tensor.hpp"
#include <Eigen/Dense>
#include <algorithm>
#include <atomic>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <mutex>
#include <string>
#include <thread>
#include <vector>
#ifdef _WIN32
#include <windows.h>
static FILE *uopen(const char *p, const char *m) {
  int n = MultiByteToWideChar(CP_UTF8, 0, p, -1, 0, 0); std::wstring w(n, 0); MultiByteToWideChar(CP_UTF8, 0, p, -1, &w[0], n);
  std::wstring wm(m, m + strlen(m)); return _wfopen(w.c_str(), wm.c_str());
}
#else
static FILE *uopen(const char *p, const char *m) { return fopen(p, m); }
#endif

static std::mutex pm;
static std::vector<float> prog;
static void report() {
  float s = 0; for (float p : prog) s += p; s /= prog.size();
  fprintf(stderr, "P %.3f\n", s); fflush(stderr);
}

int main(int argc, char **argv) {
#ifdef _WIN32
  // arguments in UTF-8 whatever the code page
  int wc = 0; LPWSTR *wv = CommandLineToArgvW(GetCommandLineW(), &wc);
  std::vector<std::string> args;
  for (int i = 0; i < wc; i++) { int n = WideCharToMultiByte(CP_UTF8, 0, wv[i], -1, 0, 0, 0, 0); std::string s(n > 0 ? n - 1 : 0, 0); if (n > 1) WideCharToMultiByte(CP_UTF8, 0, wv[i], -1, &s[0], n, 0, 0); args.push_back(s); }
#else
  std::vector<std::string> args(argv, argv + argc);
#endif
  if (args.size() < 4) { fprintf(stderr, "usage: nothi-voice model.bin in.f32 out.f32 [threads]\n"); return 2; }
  int threads = args.size() > 4 ? atoi(args[4].c_str()) : (int)std::thread::hardware_concurrency();
  if (threads < 1) threads = 1; if (threads > 16) threads = 16;

  // read the mix
  FILE *f = uopen(args[2].c_str(), "rb"); if (!f) { fprintf(stderr, "ERROR cannot read input\n"); return 3; }
  std::vector<float> raw; { float buf[8192]; size_t n; while ((n = fread(buf, sizeof(float), 8192, f)) > 0) raw.insert(raw.end(), buf, buf + n); } fclose(f);
  const long N = (long)(raw.size() / 2);
  if (N < 4410) { fprintf(stderr, "ERROR audio too short\n"); return 3; }
  Eigen::MatrixXf mix(2, N);
  for (long i = 0; i < N; i++) { mix(0, i) = raw[2 * i]; mix(1, i) = raw[2 * i + 1]; }
  std::vector<float>().swap(raw);

  static demucscpp::demucs_model model;
  if (!demucscpp::load_demucs_model(args[1], &model)) { fprintf(stderr, "ERROR cannot load model\n"); return 4; }
  const int VOC = 3; // drums, bass, other, vocals

  // split into one chunk per thread (at least ~12 s each), with overlap, then cross-fade them back
  const long SR = 44100, OV = SR * 3 / 4;
  int parts = (int)std::max(1L, std::min<long>(threads, N / (SR * 12)));
  long seg = (N + parts - 1) / parts;
  prog.assign(parts, 0.f);
  std::vector<Eigen::MatrixXf> outs(parts);
  std::vector<long> starts(parts);
  std::vector<std::thread> th;
  std::atomic<bool> failed{false};
  for (int p = 0; p < parts; p++) {
    long a = std::max(0L, p * seg - OV), b = std::min(N, (p + 1) * seg + OV);
    starts[p] = a;
    th.emplace_back([&, p, a, b]() {
      try {
        Eigen::MatrixXf chunk = mix.block(0, a, 2, b - a);
        demucscpp::ProgressCallback cb = [p](float v, const std::string &) { std::lock_guard<std::mutex> g(pm); prog[p] = v; report(); };
        Eigen::Tensor3dXf r = demucscpp::demucs_inference(model, chunk, cb);
        Eigen::MatrixXf v(2, b - a);
        for (long i = 0; i < b - a; i++) { v(0, i) = r(VOC, 0, i); v(1, i) = r(VOC, 1, i); }
        outs[p] = v;
      } catch (...) { failed = true; }
    });
  }
  for (auto &t : th) t.join();
  if (failed) { fprintf(stderr, "ERROR separation failed\n"); return 5; }

  std::vector<float> acc((size_t)N * 2, 0.f), wsum((size_t)N, 0.f);
  for (int p = 0; p < parts; p++) {
    long a = starts[p], len = outs[p].cols();
    for (long i = 0; i < len; i++) {
      long g = a + i; if (g >= N) break;
      float w = 1.f;
      if (p > 0 && i < 2 * OV) w = std::min(w, (i + 1.f) / (2 * OV));
      if (p < parts - 1 && len - i <= 2 * OV) w = std::min(w, (len - i) / (2.f * OV));
      acc[2 * g] += outs[p](0, i) * w; acc[2 * g + 1] += outs[p](1, i) * w; wsum[g] += w;
    }
  }
  for (long g = 0; g < N; g++) if (wsum[g] > 0) { acc[2 * g] /= wsum[g]; acc[2 * g + 1] /= wsum[g]; }

  FILE *o = uopen(args[3].c_str(), "wb"); if (!o) { fprintf(stderr, "ERROR cannot write output\n"); return 6; }
  fwrite(acc.data(), sizeof(float), acc.size(), o); fclose(o);
  fprintf(stderr, "P 1.000\nDONE\n");
  return 0;
}

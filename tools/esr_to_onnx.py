# Real-ESRGAN realesr-animevideov3 (SRVGGNetCompact, BSD-3) -> ONNX, without torch
import sys, zipfile, pickle, collections, numpy as np, onnx
from onnx import helper, TensorProto, numpy_helper

src, dst = sys.argv[1], sys.argv[2]
z = zipfile.ZipFile(src)
root = z.namelist()[0].split('/')[0]
DT = {'FloatStorage': np.float32, 'HalfStorage': np.float16}

class St:
    def __init__(s, name): s.name = name

def rebuild(storage, offset, size, stride, *a):
    dt, key = storage
    buf = np.frombuffer(z.read(f'{root}/data/{key}'), dtype=dt)
    n = int(np.prod(size)) if size else 1
    if not size: return buf[offset:offset + 1].reshape(())
    st = np.array(stride) * buf.itemsize
    return np.lib.stride_tricks.as_strided(buf[offset:], shape=size, strides=st).copy()

class U(pickle.Unpickler):
    def find_class(s, mod, name):
        if name == '_rebuild_tensor_v2': return rebuild
        if name == 'OrderedDict': return collections.OrderedDict
        if name in DT: return name
        if mod.startswith('torch'): return lambda *a, **k: None
        return super().find_class(mod, name)
    def persistent_load(s, pid):
        _, typ, key, loc, n = pid
        return (DT[typ], key)

ck = U(z.open(f'{root}/data.pkl')).load()
sd = ck.get('params_ema', ck.get('params', ck))
keys = sorted({int(k.split('.')[1]) for k in sd}, key=int)
nodes, inits = [], []
cur = 'input'
for i in keys:
    p = f'body.{i}'
    if f'{p}.bias' in sd:  # conv
        w = sd[f'{p}.weight'].astype(np.float32); b = sd[f'{p}.bias'].astype(np.float32)
        inits += [numpy_helper.from_array(w, f'{p}.w'), numpy_helper.from_array(b, f'{p}.b')]
        nodes.append(helper.make_node('Conv', [cur, f'{p}.w', f'{p}.b'], [f'{p}.o'], pads=[1, 1, 1, 1], kernel_shape=[3, 3]))
    else:  # prelu
        w = sd[f'{p}.weight'].astype(np.float32).reshape(-1, 1, 1)
        inits.append(numpy_helper.from_array(w, f'{p}.w'))
        nodes.append(helper.make_node('PRelu', [cur, f'{p}.w'], [f'{p}.o']))
    cur = f'{p}.o'
nodes.append(helper.make_node('DepthToSpace', [cur], ['ps'], blocksize=4, mode='CRD'))
inits.append(numpy_helper.from_array(np.array([1, 1, 4, 4], np.float32), 'scales'))
nodes.append(helper.make_node('Resize', ['input', '', 'scales'], ['up'], mode='nearest', nearest_mode='floor', coordinate_transformation_mode='asymmetric'))
nodes.append(helper.make_node('Add', ['ps', 'up'], ['output']))
g = helper.make_graph(nodes, 'esr_fast_x4', [helper.make_tensor_value_info('input', TensorProto.FLOAT, [1, 3, 'h', 'w'])],
                      [helper.make_tensor_value_info('output', TensorProto.FLOAT, [1, 3, 'H', 'W'])], inits)
m = helper.make_model(g, opset_imports=[helper.make_opsetid('', 13)], producer_name='nothi')
m.ir_version = 8
onnx.checker.check_model(m)
onnx.save(m, dst)

# check: nearest-upscale plus learned detail must look like the input, much sharper than noise
import onnxruntime as ort
s = ort.InferenceSession(dst)
y, x = np.mgrid[0:48, 0:64] / 64.0
img = np.stack([np.sin(x * 9) * .5 + .5, y, np.cos(y * 7) * .5 + .5])[None].astype(np.float32)
o = s.run(None, {'input': img})[0]
d = o.reshape(3, 48, 4, 64, 4).mean((2, 4)) - img[0]
print('out', o.shape, 'mean abs diff vs input', float(np.abs(d).mean()))

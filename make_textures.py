"""Generate three matching seamless textures (requires numpy and Pillow)."""
from pathlib import Path
import numpy as np
from PIL import Image

N = 512
y, x = np.mgrid[0:N, 0:N]
# Periodic diagonal woven relief, 7 repeats across each texture edge.
a = 2*np.pi*7*x/N
b = 2*np.pi*7*y/N
weave = np.sin(a+b)*np.sin(a-b)
thread_a = (0.5+0.5*np.cos(a+b))**12
thread_b = (0.5+0.5*np.cos(a-b))**12
stripe = np.clip(np.maximum(thread_a,thread_b),0,1)
height = 0.44 + 0.105*weave + 0.14*stripe

# Distinctive teal fabric with warm copper crossing lines.
base = np.stack([25+19*weave, 127+25*weave, 131+20*weave], axis=-1)
copper = np.array([205,118,65])
diffuse = base*(1-stripe[...,None]*0.8)+copper*stripe[...,None]*0.8

# Specular is brighter between threads than in the woven grooves.
spec = np.clip(220-173*stripe + 12*weave, 18, 255)
specular = np.stack([spec*0.85,spec*0.96,spec],axis=-1)

# The Y channel is inverted to compensate for UNPACK_FLIP_Y_WEBGL.
dx = (np.roll(height,-1,axis=1)-np.roll(height,1,axis=1))/2
dy = (np.roll(height,-1,axis=0)-np.roll(height,1,axis=0))/2
strength = 13.0
normal = np.stack([-dx*strength,dy*strength,np.ones_like(height)],axis=-1)
normal /= np.linalg.norm(normal,axis=-1,keepdims=True)
normal = (normal*0.5+0.5)*255
out = Path(__file__).resolve().parent/'textures'
out.mkdir(exist_ok=True)
for name, data in [('diffuse',diffuse),('specular',specular),('normal',normal)]:
    Image.fromarray(np.uint8(np.clip(data,0,255)),'RGB').save(out/(name+'.png'))
print('Created three textures in',out)

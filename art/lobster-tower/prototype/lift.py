from PIL import Image, ImageDraw
import numpy as np
exec(open('slice.py').read().split('H=480')[0])
im=clean(Image.open('lift.png').convert('RGBA')); A=np.array(im); a=A[:,:,3]>40
W,Hh=im.size; parts=[]
for i in range(3):
    cx=W*(2*i+1)//6
    # seed: nearest opaque pixel to the cell centre at 75% height (legs)
    y=int(Hh*0.8); xs=np.where(a[y])[0]; x=int(xs[np.argmin(abs(xs-cx))])
    m=Image.fromarray((a*255).astype("uint8")).copy(); ImageDraw.floodfill(m,(x,y),128)
    keep=np.array(m)==128
    # dilate a little so soft edges come along
    k=keep.copy()
    for dx,dy in [(1,0),(-1,0),(0,1),(0,-1),(2,0),(-2,0),(0,2),(0,-2)]: k|=np.roll(np.roll(keep,dx,1),dy,0)
    B=A.copy(); B[~k]=0; p=Image.fromarray(B); parts.append(p.crop(bbox(p)))
for i,f in enumerate(fit(parts,480,parts[1].height)): f.save(f'frames/lift-{i}.webp',quality=88); print(f.size)
s=Image.new('RGB',(1200,560),(200,200,210)); x=0
for i in range(3):
    f=Image.open(f'frames/lift-{i}.webp'); s.paste(f,(x,560-f.height),f); x+=f.width+20
s.save('liftstrip.png')

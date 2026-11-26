from PIL import Image
import numpy as np, glob
def bbox(im, t=40):
    a=np.array(im)[:,:,3]>t; ys=np.where(a.any(1))[0]; xs=np.where(a.any(0))[0]
    return (xs[0],ys[0],xs[-1]+1,ys[-1]+1)
def clean(im,t=12):
    A=np.array(im); A[A[:,:,3]<t]=0; return Image.fromarray(A)
def cells(f,n):
    im=clean(Image.open(f).convert('RGBA')); a=np.array(im)[:,:,3]>40; cnt=a.sum(0); W=im.width
    cuts=[0]
    for i in range(1,n):
        e=W*i//n; lo,hi=e-180,e+180; cuts.append(lo+int(np.argmin(cnt[lo:hi])))
    cuts.append(W); out=[]
    for s,e in zip(cuts,cuts[1:]):
        c=im.crop((s,0,e,im.height)); out.append(c.crop(bbox(c)))
    return out
def fit(frames,H,refh):
    sc=H/refh
    fr=[f.resize((round(f.width*sc),round(f.height*sc)),Image.LANCZOS) for f in frames]
    cw=max(f.width for f in fr); ch=max(f.height for f in fr); res=[]
    for f in fr:
        c=Image.new('RGBA',(cw,ch)); c.paste(f,((cw-f.width)//2,ch-f.height),f); res.append(c)
    return res
H=480
walk=cells('walk.png',6)
for i,f in enumerate(fit(walk,H,max(f.height for f in walk))): f.save(f'frames/walk-{i}.webp',quality=88)
lift=cells('lift.png',3)
for i,f in enumerate(fit(lift,H,lift[1].height)): f.save(f'frames/lift-{i}.webp',quality=88)
box=cells('box.png',3)
for i,f in enumerate(fit(box,H,box[1].height)): f.save(f'frames/work-{i}.webp',quality=88)
for p in ['door','ride','button']:
    im=clean(Image.open(p+'.png').convert('RGBA')); im=im.crop(bbox(im)); fit([im],H,im.height)[0].save(f'frames/{p}.webp',quality=88)
fs=sorted(glob.glob('frames/*'))
for f in fs: print(f, Image.open(f).size)
W=sum(Image.open(f).width for f in fs)+10*len(fs); Hm=max(Image.open(f).height for f in fs)
s=Image.new('RGB',(W,Hm),(200,200,210)); x=0
for f in fs:
    im=Image.open(f); s.paste(im,(x,Hm-im.height),im); x+=im.width+10
s.save('strip.png')

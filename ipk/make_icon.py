#!/usr/bin/env python3
"""Genera icone PNG per l'app (nessuna dipendenza, PNG scritto a mano)."""
import struct, zlib, math, os, sys

def png(path, size):
    W = H = size
    bg1 = (0x11, 0x18, 0x27)   # navy scuro
    bg2 = (0x1f, 0x2c, 0x44)
    teal = (0x2d, 0xd4, 0xbf)
    white = (0xf5, 0xf7, 0xfa)
    r = size * 0.22            # raggio angoli arrotondati
    cx, cy = W/2.0, H/2.0
    circ_r = size*0.30
    # triangolo play
    tri = [(cx-size*0.09, cy-size*0.14), (cx-size*0.09, cy+size*0.14), (cx+size*0.16, cy)]
    def inside_round(x,y):
        # rounded square mask
        dx = max(r-x, x-(W-r), 0); dy = max(r-y, y-(H-r), 0)
        return dx*dx+dy*dy <= r*r
    def in_tri(px,py):
        (x1,y1),(x2,y2),(x3,y3)=tri
        d=( (y2-y3)*(x1-x3)+(x3-x2)*(y1-y3) )
        a=((y2-y3)*(px-x3)+(x3-x2)*(py-y3))/d
        b=((y3-y1)*(px-x3)+(x1-x3)*(py-y3))/d
        c=1-a-b
        return a>=0 and b>=0 and c>=0
    rows=bytearray()
    for y in range(H):
        rows.append(0)  # filter type 0
        for x in range(W):
            if not inside_round(x+0.5,y+0.5):
                rows += bytes((0,0,0,0)); continue
            # background vertical gradient
            t=y/float(H)
            bg=tuple(int(bg1[i]*(1-t)+bg2[i]*t) for i in range(3))
            px,py=x+0.5,y+0.5
            d=math.hypot(px-cx,py-cy)
            col=bg; a=255
            if d<=circ_r:
                col=teal
            if in_tri(px,py):
                col=white
            # anti-alias bordo cerchio
            rows += bytes((col[0],col[1],col[2],a))
    raw=bytes(rows)
    def chunk(typ,data):
        c=struct.pack(">I",len(data))+typ+data
        return c+struct.pack(">I",zlib.crc32(typ+data)&0xffffffff)
    sig=b"\x89PNG\r\n\x1a\n"
    ihdr=struct.pack(">IIBBBBB",W,H,8,6,0,0,0)  # 8bit RGBA
    idat=zlib.compress(raw,9)
    with open(path,"wb") as f:
        f.write(sig+chunk(b"IHDR",ihdr)+chunk(b"IDAT",idat)+chunk(b"IEND",b""))
    print("scritto", path, os.path.getsize(path), "byte")

if __name__=="__main__":
    d=os.path.dirname(os.path.abspath(__file__))
    app=os.path.join(d,"app")
    os.makedirs(app,exist_ok=True)
    png(os.path.join(app,"icon.png"),80)
    png(os.path.join(app,"largeicon.png"),130)

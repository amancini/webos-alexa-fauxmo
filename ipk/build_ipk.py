#!/usr/bin/env python3
"""Costruisce l'IPK webOS (ar + control.tar.gz + data.tar.gz) senza dipendenze esterne."""
import io, os, tarfile, gzip, hashlib, struct, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
APPID = "com.github.amancini.alexafauxmo"
VERSION = "1.0.0"
OUT = os.path.join(HERE, "%s_%s_all.ipk" % (APPID, VERSION))
MTIME = 1700000000

def add_file(tar, arcname, data, mode):
    ti = tarfile.TarInfo(arcname)
    ti.size = len(data); ti.mode = mode; ti.mtime = MTIME
    ti.uid = ti.gid = 0; ti.uname = ti.gname = "root"
    tar.addfile(ti, io.BytesIO(data))

def add_dir(tar, arcname):
    ti = tarfile.TarInfo(arcname); ti.type = tarfile.DIRTYPE
    ti.mode = 0o755; ti.mtime = MTIME; ti.uid = ti.gid = 0; ti.uname = ti.gname = "root"
    tar.addfile(ti)

def make_targz(entries, dirs):
    """entries: list of (arcname, bytes, mode). dirs: list of arcname."""
    raw = io.BytesIO()
    with tarfile.open(fileobj=raw, mode="w", format=tarfile.GNU_FORMAT) as tar:
        for d in dirs: add_dir(tar, d)
        for name, data, mode in entries: add_file(tar, name, data, mode)
    gz = io.BytesIO()
    with gzip.GzipFile(fileobj=gz, mode="wb", mtime=0) as g:
        g.write(raw.getvalue())
    return gz.getvalue()

def ar_member(name, data):
    hdr = ("%-16s%-12d%-6d%-6d%-8s%-10d`\n" % (name, 0, 0, 0, "100644", len(data))).encode()
    out = hdr + data
    if len(data) % 2: out += b"\n"
    return out

def read(p): return open(p, "rb").read()

def main():
    # assicura fauxmo.js aggiornato nell'app dir (dalla sorgente del repo)
    shutil.copyfile(os.path.join(REPO, "src", "fauxmo.js"), os.path.join(HERE, "app", "fauxmo.js"))

    appdir = "./usr/palm/applications/%s" % APPID
    dirs = ["./usr", "./usr/palm", "./usr/palm/applications", appdir]
    data_entries = []
    for fn, mode in [("appinfo.json",0o644),("index.html",0o644),("icon.png",0o644),
                     ("largeicon.png",0o644),("fauxmo.js",0o644)]:
        data_entries.append(("%s/%s" % (appdir, fn), read(os.path.join(HERE,"app",fn)), mode))
    data_tgz = make_targz(data_entries, dirs)

    ctrl_entries = [
        ("./control", read(os.path.join(HERE,"control","control")), 0o644),
        ("./postinst", read(os.path.join(HERE,"control","postinst")), 0o755),
        ("./prerm", read(os.path.join(HERE,"control","prerm")), 0o755),
    ]
    control_tgz = make_targz(ctrl_entries, ["./"])

    ipk = b"!<arch>\n"
    ipk += ar_member("debian-binary", b"2.0\n")
    ipk += ar_member("control.tar.gz", control_tgz)
    ipk += ar_member("data.tar.gz", data_tgz)
    with open(OUT, "wb") as f: f.write(ipk)

    sha = hashlib.sha256(ipk).hexdigest()
    print("IPK:", OUT)
    print("size:", len(ipk), "byte")
    print("sha256:", sha)
    # salva hash per il manifest
    open(os.path.join(HERE,"ipk.sha256"),"w").write(sha)

if __name__ == "__main__":
    main()

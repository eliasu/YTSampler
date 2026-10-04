import json, struct

class Patch:
    def __init__(self):
        self.boxes, self.lines, self.n = [], [], 0
    def add(self, maxclass, ninl, nout, rect, text=None, otypes=None, **extra):
        self.n += 1
        bid = f"obj-{self.n}"
        b = {"id": bid, "maxclass": maxclass, "numinlets": ninl, "numoutlets": nout,
             "patching_rect": [float(v) for v in rect]}
        if nout: b["outlettype"] = otypes if otypes else [""] * nout
        if text is not None: b["text"] = text
        b.update(extra)
        self.boxes.append({"box": b})
        return bid
    def obj(self, text, ninl, nout, x, y, w=None, otypes=None, **kw):
        return self.add("newobj", ninl, nout, (x, y, w or max(40, 7 * len(text) + 12), 22), text=text, otypes=otypes, **kw)
    def msg(self, text, x, y, w=None):
        return self.add("message", 2, 1, (x, y, w or max(30, 7 * len(text) + 14), 22), text=text)
    def con(self, a, ao, b, bi):
        self.lines.append({"patchline": {"source": [a, ao], "destination": [b, bi]}})
    def to_json(self, rect):
        return {"patcher": {"fileversion": 1,
            "appversion": {"major": 8, "minor": 6, "revision": 0, "architecture": "x64", "modernui": 1},
            "classnamespace": "box", "rect": rect, "default_fontsize": 10.0, "default_fontface": 0,
            "default_fontname": "Arial Bold", "gridonopen": 1, "gridsize": [8.0, 8.0],
            "boxes": self.boxes, "lines": self.lines}}

def write_amxd(main_json, path):
    body = json.dumps(main_json, indent=1, ensure_ascii=False).encode("utf-8") + b"\n\x00"
    header = (b"ampf" + struct.pack("<I", 4) + b"iiii" + b"meta" + struct.pack("<I", 4) + struct.pack("<I", 0)
              + b"ptch" + struct.pack("<I", len(body)))
    open(path, "wb").write(header + body)

def check(path):
    d = json.load(open(path))["patcher"]
    B = {b["box"]["id"]: b["box"] for b in d["boxes"]}
    bad = [l for l in d["lines"] if l["patchline"]["source"][0] not in B or l["patchline"]["destination"][0] not in B
           or l["patchline"]["source"][1] >= B[l["patchline"]["source"][0]]["numoutlets"]
           or l["patchline"]["destination"][1] >= B[l["patchline"]["destination"][0]]["numinlets"]]
    return len(d["boxes"]), len(d["lines"]), bad

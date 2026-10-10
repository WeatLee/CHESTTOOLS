"""Pack BodyParts3D v4.3 lung segments into five browser-ready meshes.

Source meshes: BodyParts3D v4.3, CC BY-SA 2.1 JP.
Run with: python build-lung-mesh.py PATH_TO_BODY_PARTS_LUNGS
"""
import base64
import gzip
import pathlib
import struct
import sys

root = pathlib.Path(sys.argv[1])
groups = {
    "LUL": [6595, 6597, 6598, 6599, 6600],
    "LLL": [6596, 6601, 6602, 6603],
    "RUL": [6604, 6606, 6607],
    "RML": [6608, 6609],
    "RLL": [6605, 6610, 6611, 6612],
}
payload = bytearray(b"LUNG1")
payload.append(len(groups))
scale = 0.0136
for name, ids in groups.items():
    vertices = []
    faces = []
    for fj in ids:
        path = next(root.glob(f"FJ{fj}_*.obj"))
        offset = len(vertices)
        for line in path.open(encoding="utf-8"):
            if line.startswith("v "):
                x, y, z = map(float, line.split()[1:4])
                vertices.append((x * scale, (z - 1238) * scale, (-y - 106) * scale))
            elif line.startswith("f "):
                face = [int(part.split("/")[0]) - 1 + offset for part in line.split()[1:]]
                if len(face) == 3:
                    faces.extend(face)
    payload.extend(name.encode("ascii"))
    payload.extend(struct.pack("<II", len(vertices), len(faces)))
    for vertex in vertices:
        payload.extend(struct.pack("<fff", *vertex))
    for index in faces:
        payload.extend(struct.pack("<I", index))
    print(name, len(vertices), len(faces) // 3)
packed = gzip.compress(payload, compresslevel=9)
target = pathlib.Path(__file__).parent / "src" / "lung-mesh-data.js"
target.write_text("// BodyParts3D v4.3 modified lung meshes, CC BY-SA 2.1 JP.\nexport default '" + base64.b64encode(packed).decode("ascii") + "';\n", encoding="utf-8")
print(f"Wrote {target} ({len(packed):,} compressed bytes)")

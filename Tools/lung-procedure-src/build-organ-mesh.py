"""Pack aligned BodyParts3D heart and great vessel OBJ meshes.

Source: BodyParts3D v4.3, CC BY-SA 2.1 JP.
Run: python build-organ-mesh.py PATH_TO_BODY_PARTS_SOURCE
"""
import base64
import gzip
import math
import pathlib
import struct
import sys

root = pathlib.Path(sys.argv[1])
groups = {
    "HEAR": [2428, 2438, 2439],
    "AORT": [3411, 3413, 3427],
    "NECA": [3417, 3564],
    "NEJV": [3482, 3583, 3485, 3585, 3645],
    "PULA": [2966, 2924, 3019],
    "PULV": [2925, 2933, 2944, 2950, 2955, 3020, 3040],
}
data = bytearray(b"ORGN1")
data.append(len(groups))
scale = .0136
for key, ids in groups.items():
    vertices, faces = [], []
    for fj in ids:
        path = next(root.rglob(f"FJ{fj}_*.obj"))
        local_vertices, local_faces = [], []
        for line in path.open(encoding="utf-8"):
            if line.startswith("v "):
                x, y, z = map(float, line.split()[1:4])
                local_vertices.append((x, y, z))
            elif line.startswith("f "):
                face = [int(part.split("/")[0]) - 1 for part in line.split()[1:]]
                if len(face) == 3:
                    local_faces.append(face)
        # The source descending aorta continues far below the displayed lungs.
        if fj == 3427:
            floor = 1124.0
            clipped = []
            cap_points = []
            for face in local_faces:
                poly = [local_vertices[i] for i in face]
                output = []
                for i, current in enumerate(poly):
                    previous = poly[i - 1]
                    inside_current = current[2] >= floor
                    inside_previous = previous[2] >= floor
                    if inside_current != inside_previous:
                        t = (floor - previous[2]) / (current[2] - previous[2])
                        edge = tuple(previous[k] + t * (current[k] - previous[k]) for k in range(2)) + (floor,)
                        output.append(edge)
                        cap_points.append(edge)
                    if inside_current:
                        output.append(current)
                if len(output) >= 3:
                    base = len(local_vertices)
                    local_vertices.extend(output)
                    for i in range(1, len(output) - 1):
                        clipped.append([base, base + i, base + i + 1])
            if cap_points:
                unique = list({(round(x, 3), round(y, 3), floor) for x, y, _ in cap_points})
                cx = sum(p[0] for p in unique) / len(unique)
                cy = sum(p[1] for p in unique) / len(unique)
                unique.sort(key=lambda p: math.atan2(p[1] - cy, p[0] - cx))
                center = len(local_vertices)
                local_vertices.append((cx, cy, floor))
                ring_start = len(local_vertices)
                local_vertices.extend(unique)
                for i in range(len(unique)):
                    clipped.append([center, ring_start + (i + 1) % len(unique), ring_start + i])
            local_faces = clipped
        used = sorted({i for face in local_faces for i in face})
        mapping = {old: new + len(vertices) for new, old in enumerate(used)}
        for old in used:
            x, y, z = local_vertices[old]
            vertices.append((x * scale, (z - 1238) * scale, (-y - 106) * scale))
        for face in local_faces:
            faces.extend(mapping[i] for i in face)
    data.extend(key.encode("ascii"))
    data.extend(struct.pack("<II", len(vertices), len(faces)))
    for vertex in vertices:
        data.extend(struct.pack("<fff", *vertex))
    for face in faces:
        data.extend(struct.pack("<I", face))
    print(key, len(vertices), len(faces) // 3)
target = pathlib.Path(__file__).parent / "src" / "organ-mesh-data.js"
packed = gzip.compress(data, compresslevel=9)
target.write_text("// Modified BodyParts3D v4.3 geometry; CC BY-SA 2.1 JP.\nexport default '" + base64.b64encode(packed).decode("ascii") + "';\n", encoding="utf-8")
print(f"Wrote {target} ({len(packed):,} compressed bytes)")

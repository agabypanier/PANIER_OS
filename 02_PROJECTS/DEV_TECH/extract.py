import os
import re

directories = {
    'Tome1': r'c:\Users\0000\Desktop\Genesis\liv\tome_1',
    'Tome2': r'c:\Users\0000\Desktop\Genesis\liv\tome_2',
    'Tome3': r'c:\Users\0000\Desktop\Genesis\liv\tome_3'
}

def extract_num(filename):
    match = re.search(r'\d+', filename)
    return int(match.group()) if match else 0

for tome_name, path in directories.items():
    if not os.path.exists(path):
        print(f"Directory {path} not found.")
        continue
    
    files = [f for f in os.listdir(path) if f.endswith('.md')]
    
    if tome_name == 'Tome3':
        part_a = [f for f in files if f.startswith('chapit_')]
        epilogue_a = [f for f in files if f == 'epilogue_partie_a.md']
        part_b = [f for f in files if f.startswith('partie_b_chapit_')]
        part_a.sort(key=extract_num)
        part_b.sort(key=extract_num)
        files = part_a + epilogue_a + part_b
    else:
        files.sort(key=extract_num)

    out_path = fr'c:\Users\0000\Desktop\{tome_name}_outline.txt'
    with open(out_path, 'w', encoding='utf-8') as outfile:
        for fname in files:
            fpath = os.path.join(path, fname)
            outfile.write(f"\n--- {fname} ---\n")
            with open(fpath, 'r', encoding='utf-8') as infile:
                lines = infile.readlines()
                # Get headers and first few non-empty lines
                content_lines = 0
                for line in lines:
                    line = line.strip()
                    if line.startswith('#'):
                        outfile.write(line + "\n")
                    elif line and content_lines < 3:
                        outfile.write(line + "\n")
                        content_lines += 1
    print(f"Wrote outline for {tome_name} to {out_path} ({len(files)} chapters).")

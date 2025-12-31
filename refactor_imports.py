
import os
import re

def resolve_path(current_file, import_path):
    # import_path is like "shared/X" or "./X" or "../X"
    if import_path.startswith("shared/"):
        return os.path.join("src", "shared", import_path.replace("shared/", "") + ".ts")
    elif import_path.startswith("./") or import_path.startswith("../"):
        # Resolve relative to current_file
        base_dir = os.path.dirname(current_file)
        # Normalize
        full_path = os.path.normpath(os.path.join(base_dir, import_path))
        if not full_path.endswith(".ts") and not full_path.endswith(".tsx"):
            full_path += ".ts"
        return full_path
    return None

def determine_export_type(file_path):
    if not os.path.exists(file_path):
        # Maybe it's a folder with index.ts?
        if os.path.exists(file_path.replace(".ts", "/index.ts")):
            file_path = file_path.replace(".ts", "/index.ts")
        elif os.path.exists(file_path.replace(".ts", "/init.ts")):
             file_path = file_path.replace(".ts", "/init.ts")
        else:
             print(f"Warning: Could not resolve {file_path}")
             return "Named" # Fallback
    
    with open(file_path, "r") as f:
        content = f.read()
    
    if "export =" in content:
        return "CommonJS"
    if "export default" in content:
        return "Default"
    return "Named"

def process_file(file_path):
    with open(file_path, "r") as f:
        content = f.read()
    
    # Regex to capture: const X = require(...) as typeof import("Y");
    # We rely on the import string "Y".
    regex = r'const\s+(\w+)\s*=\s*require\(.*?\)\s*as\s*typeof\s*import\("([^"]+)"\);'
    
    new_content = content
    matches = list(re.finditer(regex, content))
    
    # Process in reverse to maintain indices or just replace strings? 
    # String replacement is safer if unique, but regex reconstruction is better.
    # We'll buffer replacements.
    
    replacements = []
    
    for match in matches:
        var_name = match.group(1)
        import_path = match.group(2)
        full_match = match.group(0)
        
        target_file = resolve_path(file_path, import_path)
        if target_file:
            export_type = determine_export_type(target_file)
            
            if export_type == "Default":
                replacement = f'import {var_name} from "{import_path}";'
            elif export_type == "CommonJS":
                replacement = f'import {var_name} = require("{import_path}");'
            else: # Named
                replacement = f'import * as {var_name} from "{import_path}";'
            
            replacements.append((full_match, replacement))
            
    for old, new in replacements:
        new_content = new_content.replace(old, new)
        
    if new_content != content:
        with open(file_path, "w") as f:
            f.write(new_content)
        print(f"Updated {file_path}")

# Fix specific loop in MapGenerator.ts explicitly handled by sed previously but ensuring it sticks
# No, relying on sed for that.
        
# Walk src
for root, dirs, files in os.walk("src"):
    for file in files:
        if file.endswith(".ts") or file.endswith(".tsx"):
            process_file(os.path.join(root, file))

import os
import re

def find_inline_components(directory):
    for root, _, files in os.walk(directory):
        for file in files:
            if file.endswith('.jsx'):
                filepath = os.path.join(root, file)
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Look for a functional component definition
                component_matches = re.finditer(r'(?:export\s+default\s+function|export\s+function|const)\s+([A-Z]\w*)\s*(?:=\s*(?:\([^)]*\)|[^=]*)\s*=>|\([^)]*\))\s*\{', content)
                
                for match in component_matches:
                    start_index = match.end()
                    # Now search inside this component for ANOTHER component definition
                    # We just use a simple heuristic: look for "const [A-Z]\w* = (" or "function [A-Z]\w*(" before the next top-level export/const
                    
                    # Let's just find ALL component definitions and see if any is indented or inside another
                    lines = content.split('\n')
                    stack = []
                    for i, line in enumerate(lines):
                        # Very simple heuristic: if a line defines a component, check its indentation
                        if re.search(r'(?:const|function)\s+[A-Z]\w*\s*(?:=|\()', line):
                            # Exclude common non-components like MAX_ITEMS, constants, etc.
                            if re.search(r'(?:const|function)\s+[A-Z][a-z]\w*\s*(?:=|\()', line):
                                print(f"{filepath}:{i+1}: {line.strip()}")

find_inline_components('src')

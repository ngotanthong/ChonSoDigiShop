import re

with open('sodep.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# find exactly where analyzeSIM starts and ends
start_idx = -1
end_idx = -1
for i, line in enumerate(lines):
    if line.startswith("        function analyzeSIM(numStr, monthlyFee = 0) {"):
        start_idx = i
    if line.startswith("        // --- AUTO SCAN ENGINE ---"):
        end_idx = i - 1 # the empty line before it
        break

if start_idx != -1 and end_idx != -1:
    analyze_sim_lines = lines[start_idx:end_idx]
    
    with open('ai-scoring.js', 'w', encoding='utf-8') as f:
        f.write("// --- AI SCORING ENGINE ---\n")
        f.writelines(analyze_sim_lines)
    
    # Remove from sodep.html
    new_sodep = lines[:start_idx] + ["        // analyzeSIM function moved to ai-scoring.js\n"] + lines[end_idx:]
    sodep_content = "".join(new_sodep)
    
    # Add script tag
    sodep_content = sodep_content.replace('<script src="accounts.js"></script>', '<script src="accounts.js"></script>\n    <script src="ai-scoring.js"></script>')
    
    with open('sodep.html', 'w', encoding='utf-8') as f:
        f.write(sodep_content)
    
    print(f"Successfully moved analyzeSIM (lines {start_idx}-{end_idx}) to ai-scoring.js")
else:
    print("Could not find boundaries")

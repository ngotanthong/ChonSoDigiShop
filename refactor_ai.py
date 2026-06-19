import re

# Read sodep.html
with open('sodep.html', 'r', encoding='utf-8') as f:
    sodep_content = f.read()

# Find the analyzeSIM function using regex
match = re.search(r'(\s*function analyzeSIM\(numStr, monthlyFee = 0\) \{.*?\n\s*\})', sodep_content, re.DOTALL)
if match:
    analyze_function_code = match.group(1)
    
    # Write to ai-scoring.js
    with open('ai-scoring.js', 'w', encoding='utf-8') as f:
        f.write("// --- AI SCORING ENGINE ---\n")
        f.write(analyze_function_code.strip() + "\n")
    
    # Remove from sodep.html
    new_sodep = sodep_content.replace(analyze_function_code, "\n        // analyzeSIM function moved to ai-scoring.js\n")
    
    # Add script tag to sodep.html
    new_sodep = new_sodep.replace('<script src="accounts.js"></script>', '<script src="accounts.js"></script>\n    <script src="ai-scoring.js"></script>')
    
    with open('sodep.html', 'w', encoding='utf-8') as f:
        f.write(new_sodep)
    
    print("Successfully refactored analyzeSIM from sodep.html to ai-scoring.js")
else:
    print("Could not find analyzeSIM function in sodep.html")

# Read index.html and add script tag
with open('index.html', 'r', encoding='utf-8') as f:
    index_content = f.read()

if '<script src="ai-scoring.js"></script>' not in index_content:
    new_index = index_content.replace('<script src="accounts.js"></script>', '<script src="accounts.js"></script>\n    <script src="ai-scoring.js"></script>')
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(new_index)
    print("Added ai-scoring.js to index.html")


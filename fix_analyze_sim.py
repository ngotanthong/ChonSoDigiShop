import re

with open('ai-scoring.js', 'r', encoding='utf-8') as f:
    ai_scoring_content = f.read()

# Extract analyzeSIM function
start_idx = ai_scoring_content.find('function analyzeSIM(numStr, monthlyFee = 0) {')
end_idx = ai_scoring_content.find('}\n\n', start_idx)
if end_idx == -1:
    end_idx = len(ai_scoring_content)

# Fix: the end of analyzeSIM in ai-scoring.js is actually:
match = re.search(r'return \{.*?};\n        }', ai_scoring_content[start_idx:], re.DOTALL)
if match:
    end_idx = start_idx + match.end()

analyze_sim_code = ai_scoring_content[start_idx:end_idx].strip() + "\n"

# Remove document.getElementById
analyze_sim_code = analyze_sim_code.replace(
    "const isPhongThuyMode = document.getElementById('togglePhongThuy') && document.getElementById('togglePhongThuy').checked;",
    "const isPhongThuyMode = false; // Không dùng chế độ Phong Thuỷ khi quét bằng GAS"
)

with open('huongdan_sheets.md', 'r', encoding='utf-8') as f:
    huongdan = f.read()

# Find analyzeSIM in huongdan
start_md = huongdan.find('  function analyzeSIM(numStr, monthlyFee = 0) {')

match_md = re.search(r'return \{.*?};\n  }', huongdan[start_md:], re.DOTALL)
if match_md:
    end_md = start_md + match_md.end()
else:
    print("Could not find end of analyzeSIM in huongdan_sheets.md")
    exit(1)

indented_code = ""
for line in analyze_sim_code.split('\n'):
    if line.strip() == "":
        indented_code += "\n"
    else:
        if line.startswith('        '):
            indented_code += line[6:] + "\n"
        elif line.startswith('    '):
            indented_code += line[2:] + "\n"
        else:
            indented_code += "  " + line + "\n"

indented_code = indented_code.rstrip() + "\n"

huongdan_new = huongdan[:start_md] + indented_code + huongdan[end_md:]

with open('huongdan_sheets.md', 'w', encoding='utf-8') as f:
    f.write(huongdan_new)
print("Updated huongdan_sheets.md successfully")

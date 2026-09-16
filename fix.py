with open('src/components/PageBlocks.tsx', 'r') as f:
    code = f.read()

start_idx = code.find('{type === "quick_contact_form" ? (')
print(len(code[start_idx:start_idx+5000]))

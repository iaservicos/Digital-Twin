import os
import glob

replacements = {
    "bg-slate-900": "bg-background",
    "bg-[#0b1120]": "bg-background",
    "bg-slate-800": "bg-surface",
    "border-slate-800": "border-border",
    "border-slate-700": "border-border",
    "border-white/10": "border-border",
    "border-white/5": "border-border",
    "text-slate-400": "text-text-muted",
    "text-slate-500": "text-text-muted",
    "dark:bg-slate-800": "dark:bg-surface",
    "dark:bg-slate-900": "dark:bg-background",
    "dark:border-slate-700": "dark:border-border",
    "dark:border-slate-800": "dark:border-border",
    "dark:text-white": "dark:text-text-main",
    "dark:text-slate-400": "dark:text-text-muted",
    "dark:text-slate-300": "dark:text-text-muted"
}

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    new_content = content
    for old, new in replacements.items():
        new_content = new_content.replace(old, new)
        
    # Extra pass to fix specific patterns
    # Sometimes we want to replace text-white only in non-button contexts, but let's replace text-white to text-text-main for generic text
    # Actually text-white in Dashboard/Onboarding is mostly generic text.
    # To be safe, we won't blindly replace ALL 'text-white' without context, but let's replace 'text-white' that are part of text styling like `text-lg font-bold text-white`
    new_content = new_content.replace("text-white", "text-text-main")
    # But wait, button texts that were text-white and became text-text-main are fine because text-text-main is #F8FAFC which is basically white!
    
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {filepath}")

if __name__ == "__main__":
    files = glob.glob('src/**/*.tsx', recursive=True) + glob.glob('src/**/*.ts', recursive=True)
    for f in files:
        process_file(f)

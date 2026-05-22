#!/usr/bin/env python3
"""Build one-folder SMCC upload package — dashboard + PHP API, same origin."""
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "hosting-bundle"
HOSTING = ROOT / "hosting"
SBCC = ROOT / "SBCC"


def main():
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()

    shutil.copy2(ROOT / "index.html", OUT / "index.html")
    shutil.copy2(SBCC / "command-center.html", OUT / "command-center.html")
    shutil.copytree(SBCC / "mobile", OUT / "mobile")
    shutil.copytree(SBCC / "js", OUT / "js")
    shutil.copytree(HOSTING / "api", OUT / "api")

    shutil.copy2(HOSTING / "sw.js", OUT / "sw.js")
    shutil.copy2(HOSTING / ".htaccess.example", OUT / ".htaccess.example")
    shutil.copy2(ROOT / "DEPLOY.md", OUT / "DEPLOY.md")

    idx = (OUT / "index.html").read_text(encoding="utf-8")
    idx = idx.replace('href="SBCC/command-center.html"', 'href="command-center.html"')
    idx = idx.replace('href="SBCC/mobile/command-center.html"', 'href="mobile/command-center.html"')
    idx = idx.replace("location.href='SBCC/command-center.html'", "location.href='command-center.html'")
    (OUT / "index.html").write_text(idx, encoding="utf-8")

    for html in [OUT / "command-center.html", OUT / "mobile" / "command-center.html"]:
        t = html.read_text(encoding="utf-8")
        if "sbcc-api.js" not in t:
            t = t.replace(
                '<script src="js/sbcc-research-layer.js"></script>',
                '<script src="js/sbcc-api.js"></script>\n<script src="js/sbcc-research-layer.js"></script>',
            )
            if html.name == "command-center.html":
                pass
            else:
                t = t.replace('src="../js/sbcc-research-layer.js"', 'src="../js/sbcc-api.js"></script>\n<script src="../js/sbcc-research-layer.js"')
        if "sbcc-api.js" not in t:
            t = t.replace(
                '<script src="../js/sbcc-research-layer.js"></script>',
                '<script src="../js/sbcc-api.js"></script>\n<script src="../js/sbcc-research-layer.js"></script>',
            )
        if 'sbcc-api.js' not in t:
            t = t.replace(
                '<script src="js/sbcc-research-layer.js"></script>',
                '<script src="js/sbcc-api.js"></script>\n<script src="js/sbcc-research-layer.js"></script>',
            )
        if 'navigator.serviceWorker' not in t:
            t = t.replace('</body>', '<script>if("serviceWorker" in navigator){navigator.serviceWorker.register("./sw.js").catch(function(){})}</script>\n</body>')
        html.write_text(t, encoding="utf-8")

    desktop = (OUT / "command-center.html").read_text(encoding="utf-8")
    if "sbcc-api.js" not in desktop:
        desktop = desktop.replace(
            '<link rel="stylesheet" href="js/sbcc-research-layer.css">',
            '<link rel="stylesheet" href="js/sbcc-research-layer.css">',
        )
        desktop = desktop.replace(
            '<script src="js/sbcc-research-layer.js"></script>',
            '<script src="js/sbcc-api.js"></script>\n<script src="js/sbcc-research-layer.js"></script>',
        )
        desktop = desktop.replace('</body>', '<script>if("serviceWorker" in navigator){navigator.serviceWorker.register("./sw.js").catch(function(){})}</script>\n</body>')
        (OUT / "command-center.html").write_text(desktop, encoding="utf-8")

    print("Hosting bundle ready:", OUT)
    print("Upload everything inside hosting-bundle/ to your secret web folder.")


if __name__ == "__main__":
    main()

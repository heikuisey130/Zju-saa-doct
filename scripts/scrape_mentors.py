import json
import re
import sys
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

BASE_URL = "http://saa.zju.edu.cn/szdw/list.htm"

def clean_text(text):
    if not text:
        return ""
    return re.sub(r"\s+", " ", text).strip()

def fetch(url):
    resp = requests.get(url, timeout=20)
    resp.encoding = resp.apparent_encoding or "utf-8"
    resp.raise_for_status()
    return resp.text

def parse_list(html):
    soup = BeautifulSoup(html, "lxml")
    result = []
    for sublist in soup.select("ul.wp_subcolumn_list > li.wp_sublist"):
        title_el = sublist.select_one("h3.sublist_title .subcolumn-name")
        institute = clean_text(title_el.get_text()) if title_el else ""
        for a in sublist.select("ul.news_list li.news a"):
            name = clean_text(a.get_text())
            href = a.get("href")
            if not href:
                continue
            url = urljoin(BASE_URL, href)
            result.append({"name": name, "institute": institute, "profile_url": url})
    return result

def extract_title_and_research_from_person(soup):
    # title in div.zc span
    title = ""
    supervisors = []
    zc = soup.select_one("div.zc")
    if zc:
        spans = [clean_text(s.get_text()) for s in zc.select("span")]
        # preserve all titles: take the first non-empty span that isn't a supervisor label
        for s in spans:
            if not s or s in ("博士生导师", "硕士生导师"):
                continue
            title = s
            break
        for s in spans:
            if s in ("博士生导师", "硕士生导师"):
                supervisors.append(s)
    if not title:
        # fallback: any label with text "职称"
        for label in soup.find_all("label"):
            if clean_text(label.get_text()) == "职称":
                parent_text = clean_text(label.parent.get_text())
                title = parent_text.replace("职称", "").strip()
                break

    # research directions
    research = []
    yjfx = soup.select_one("li.yjfx")
    if yjfx:
        for li in yjfx.select("ul.second_research li"):
            item = clean_text(li.get_text())
            if item:
                research.append(item)
        if not research:
            # sometimes all text in one li
            text = clean_text(yjfx.get_text())
            text = text.replace("研究方向", "").strip()
            if text:
                research = [text]
    else:
        # try generic search for "研究方向"
        for label in soup.find_all(["label", "b", "strong"]):
            if "研究方向" in clean_text(label.get_text()):
                parent_text = clean_text(label.parent.get_text())
                parent_text = parent_text.replace("研究方向", "").strip()
                if parent_text:
                    research = [parent_text]
                break

    return title, research, supervisors

def extract_title_and_research_from_saa(soup):
    title = ""
    research = []
    supervisors = []
    # Try to locate any text containing "研究方向" within article content
    content = soup.select_one(".wp_articlecontent")
    if content:
        text = clean_text(content.get_text("\n"))
        # Extract line after 研究方向
        m = re.search(r"研究方向[:：]?\s*([^\n]+)", text)
        if m:
            research = [clean_text(m.group(1))]
        m2 = re.search(r"职称[:：]?\s*([^\n]+)", text)
        if m2:
            title = clean_text(m2.group(1))
    return title, research, supervisors

def extract_title_and_research(url):
    html = fetch(url)
    soup = BeautifulSoup(html, "lxml")
    if "person.zju.edu.cn" in url or "mypage.zju.edu.cn" in url:
        return extract_title_and_research_from_person(soup)
    if "saa.zju.edu.cn" in url:
        return extract_title_and_research_from_saa(soup)
    # fallback generic
    return "", [], []

def main():
    html = fetch(BASE_URL)
    mentors = parse_list(html)

    for i, m in enumerate(mentors, 1):
        try:
            title, research, supervisors = extract_title_and_research(m["profile_url"])
        except Exception as e:
            title, research, supervisors = "", [], []
            m["error"] = str(e)
        m["title"] = title or "未知"
        m["research"] = research
        m["supervisors"] = supervisors
        if i % 10 == 0:
            print(f"Processed {i}/{len(mentors)}", file=sys.stderr)

    with open("data/mentors.json", "w", encoding="utf-8") as f:
        json.dump(mentors, f, ensure_ascii=False, indent=2)

    with open("data/mentors.js", "w", encoding="utf-8") as f:
        payload = json.dumps(mentors, ensure_ascii=False, indent=2)
        f.write("window.MENTORS_DATA = " + payload + ";\n")

if __name__ == "__main__":
    main()

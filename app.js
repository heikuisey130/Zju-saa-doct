(() => {
  const mentors = Array.isArray(window.MENTORS_DATA) ? window.MENTORS_DATA : [];

  const searchInput = document.getElementById("searchInput");
  const clearBtn = document.getElementById("clearBtn");
  const groupedView = document.getElementById("groupedView");
  const searchView = document.getElementById("searchView");
  const countInfo = document.getElementById("countInfo");
  const navTags = document.getElementById("navTags");
  const instituteNav = document.getElementById("instituteNav");

  const titleOrder = ["教授", "副教授", "讲师"];

  function normalizeMentor(m) {
    // Clean research directions: remove leading dots and trim
    const cleanResearch = (arr) => {
      if (!Array.isArray(arr) || arr.length === 0) return ["未注明"];
      return arr.map(r => r.replace(/^[·\s]+/, '').trim()).filter(r => r);
    };
    const research = cleanResearch(m.research);
    const rawTitle = (m.title || "").trim();
    const title = rawTitle || "未知";
    const supervisors = Array.isArray(m.supervisors) && m.supervisors.length > 0
      ? m.supervisors
      : ["未注明"];
    return {
      name: m.name || "",
      institute: m.institute || "",
      profile_url: m.profile_url || "",
      title,
      research: research.length > 0 ? research : ["未注明"],
      supervisors
    };
  }

  const normalized = mentors.map(normalizeMentor);

  function titleRank(title) {
    const idx = titleOrder.indexOf(title);
    return idx === -1 ? titleOrder.length + 1 : idx;
  }

  function buildGroupedView(data) {
    groupedView.innerHTML = "";

    const groupMap = new Map();

    data.forEach((m) => {
      const key = m.institute || "未注明研究所";
      if (!groupMap.has(key)) {
        groupMap.set(key, new Map());
      }
      const titleMap = groupMap.get(key);
      if (!titleMap.has(m.title)) {
        titleMap.set(m.title, []);
      }
      titleMap.get(m.title).push(m);
    });

    const institutes = Array.from(groupMap.keys()).sort((a, b) => a.localeCompare(b, "zh"));

    institutes.forEach((inst) => {
      const titleMap = groupMap.get(inst);
      const titles = Array.from(titleMap.keys()).sort((a, b) => titleRank(a) - titleRank(b));

      const section = document.createElement("section");
      section.className = "section";
      // Add id for navigation anchor
      const sectionId = "inst-" + institutes.indexOf(inst);
      section.id = sectionId;

      const header = document.createElement("div");
      header.className = "section-header";
      header.textContent = inst;
      const count = document.createElement("span");
      count.className = "title-tag";
      count.textContent = `${titles.reduce((acc, t) => acc + titleMap.get(t).length, 0)} 位`;
      header.appendChild(count);
      section.appendChild(header);

      titles.forEach((title) => {
        const list = titleMap.get(title).sort((a, b) => a.name.localeCompare(b.name, "zh"));
        const sub = document.createElement("div");
        sub.className = "subheader";
        sub.innerHTML = `${title} <span class="badge">${list.length}</span>`;
        section.appendChild(sub);

        const table = document.createElement("table");
        table.className = "table table-grouped";
        table.innerHTML = `
          <thead>
            <tr>
              <th>姓名</th>
              <th>职称</th>
              <th>导师类型</th>
              <th>研究方向</th>
              <th>主页</th>
            </tr>
          </thead>
          <tbody></tbody>
        `;

        const tbody = table.querySelector("tbody");
        list.forEach((m) => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td>${m.name}</td>
            <td>${m.title}</td>
            <td>${renderSupervisorBadges(m.supervisors)}</td>
            <td>${m.research.join("; ")}</td>
            <td><a class="link" href="${m.profile_url}" target="_blank" rel="noopener">主页</a></td>
          `;
          tbody.appendChild(tr);
        });

        section.appendChild(table);
      });

      groupedView.appendChild(section);
    });

    // Build navigation tags
    buildNavTags(institutes);
  }

  function buildNavTags(institutes) {
    navTags.innerHTML = "";
    institutes.forEach((inst, idx) => {
      const tag = document.createElement("a");
      tag.className = "nav-tag";
      tag.textContent = inst;
      tag.href = "#inst-" + idx;
      tag.addEventListener("click", (e) => {
        e.preventDefault();
        const target = document.getElementById("inst-" + idx);
        if (target) {
          const navHeight = instituteNav.offsetHeight;
          const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - navHeight - 10;
          window.scrollTo({ top: targetPosition, behavior: "smooth" });
        }
      });
      navTags.appendChild(tag);
    });
  }

  function buildSearchView(data) {
    searchView.innerHTML = "";

    const section = document.createElement("section");
    section.className = "section";

    const header = document.createElement("div");
    header.className = "section-header";
    header.textContent = `搜索结果`;
    const count = document.createElement("span");
    count.className = "title-tag";
    count.textContent = `${data.length} 位`;
    header.appendChild(count);
    section.appendChild(header);

    const table = document.createElement("table");
    table.className = "table table-search";
    table.innerHTML = `
      <thead>
        <tr>
          <th>姓名</th>
          <th>职称</th>
          <th>导师类型</th>
          <th>研究方向</th>
          <th>研究所/中心</th>
          <th>主页</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;

    const tbody = table.querySelector("tbody");
    data.forEach((m) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${m.name}</td>
        <td>${m.title}</td>
        <td>${renderSupervisorBadges(m.supervisors)}</td>
        <td>${m.research.join("; ")}</td>
        <td>${m.institute}</td>
        <td><a class="link" href="${m.profile_url}" target="_blank" rel="noopener">主页</a></td>
      `;
      tbody.appendChild(tr);
    });

    section.appendChild(table);
    searchView.appendChild(section);
  }

  function updateCount() {
    countInfo.textContent = `导师总数：${normalized.length} 位`;
  }

  function applySearch() {
    const q = searchInput.value.trim().toLowerCase();
    if (!q) {
      searchView.classList.add("hidden");
      groupedView.classList.remove("hidden");
      instituteNav.classList.remove("hidden");
      buildGroupedView(normalized);
      updateCount();
      return;
    }

    const filtered = normalized.filter((m) => {
      const haystack = [
        m.name,
        m.institute,
        m.title,
        ...m.supervisors,
        ...m.research
      ].join(" ").toLowerCase();
      return haystack.includes(q);
    });

    groupedView.classList.add("hidden");
    searchView.classList.remove("hidden");
    instituteNav.classList.add("hidden");
    buildSearchView(filtered);
    countInfo.textContent = `搜索结果：${filtered.length} / ${normalized.length} 位`;
  }

  function renderSupervisorBadges(items) {
    if (!items || items.length === 0) {
      return `<span class="badge badge-muted">未注明</span>`;
    }
    return items.map((s) => {
      const cls = s.includes("博士") ? "badge badge-mentor" : "badge badge-mentor-alt";
      const icon = s.includes("博士") ? "🎓" : "📘";
      return `<span class="${cls}">${icon} ${s}</span>`;
    }).join(" ");
  }

  searchInput.addEventListener("input", applySearch);
  clearBtn.addEventListener("click", () => {
    searchInput.value = "";
    applySearch();
  });

  buildGroupedView(normalized);
  updateCount();
})();

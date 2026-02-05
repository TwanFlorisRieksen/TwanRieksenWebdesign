(() => {
  'use strict';

  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  function safeText(v){ return (v === undefined || v === null) ? '' : String(v); }

  async function fetchJSON(path, fallback){
    try{
      const res = await fetch(path, {cache:'no-store'});
      if(res.ok) return await res.json();
      throw new Error('HTTP '+res.status);
    }catch(err){
      if(fallback && fallback.owner && fallback.repo){
        const url = `https://raw.githubusercontent.com/${fallback.owner}/${fallback.repo}/${fallback.branch||'main'}/${path}`;
        const res2 = await fetch(url, {cache:'no-store'});
        if(res2.ok) return await res2.json();
      }
      throw err;
    }
  }

  function getKey(){
    return document.body.getAttribute('data-content') || 'home';
  }

  function bindSimple(root, ctx){
    // data-bind="path.to.value"
    $$('[data-bind]', root).forEach(el=>{
      const p = el.getAttribute('data-bind');
      const v = getByPath(ctx, p);

      // Meta tags need attribute binding (content="...")
      if(el.tagName === 'META'){
        const fallbackDesc = (el.getAttribute('name') === 'description')
          ? getByPath(ctx, 'site.seo.site_description')
          : undefined;

        if(v !== undefined) el.setAttribute('content', String(v));
        else if(fallbackDesc) el.setAttribute('content', String(fallbackDesc));
        return;
      }

      if(v !== undefined){
        el.textContent = safeText(v);
      }
    });
    // data-bind-src, data-bind-alt
    $$('[data-bind-src]', root).forEach(el=>{
      const p = el.getAttribute('data-bind-src');
      const v = getByPath(ctx, p);
      if(v) el.setAttribute('src', String(v));
    });
    $$('[data-bind-alt]', root).forEach(el=>{
      const p = el.getAttribute('data-bind-alt');
      const v = getByPath(ctx, p);
      if(v !== undefined) el.setAttribute('alt', String(v));
    });
    // data-bind-href (safe, backward-compatible)
    $$('[data-bind-href]', root).forEach(el=>{
      const p = el.getAttribute('data-bind-href');
      const v = getByPath(ctx, p);
      if(v) el.setAttribute('href', String(v));
    });
  }

    function injectJsonLd(ctx, pageKey){
    try{
      const site = (ctx && ctx.site) ? ctx.site : {};
      const seo = site.seo || {};
      const brand = site.brand || {};
      const contact = site.contact || {};
      const url = seo.site_url || 'https://twanrieksenwebdesign.nl';
      const name = seo.business_name || brand.name || 'Twan Rieksen Webdesign';
      const email = seo.contact_email || contact.email || '';
      const phone = seo.contact_phone || contact.phone || '';
      const areaServed = seo.area_served || 'Netherlands';
      const priceRange = seo.price_range || undefined;
      const sameAs = Array.isArray(seo.same_as) ? seo.same_as.filter(Boolean) : [];

      // ProfessionalService entity
      const serviceSchema = {
        "@context": "https://schema.org",
        "@type": "ProfessionalService",
        "name": name,
        "url": url,
        ...(email ? {"email": email} : {}),
        ...(phone ? {"telephone": phone} : {}),
        ...(priceRange ? {"priceRange": priceRange} : {}),
        "areaServed": {"@type":"Country","name": areaServed},
        ...(sameAs.length ? {"sameAs": sameAs} : {})
      };

      // WebSite entity (basic)
      const websiteSchema = {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": name,
        "url": url
      };

      // Hergebruik bestaande jsonld-script als die er is, anders nieuw aanmaken
      upsertJsonLd('jsonld-service', serviceSchema, 'script[data-meta="jsonld"]');
      upsertJsonLd('jsonld-website', websiteSchema);

      // FAQPage schema alleen op /diensten, gebaseerd op bestaande (zichtbare) FAQ data
      if(pageKey === 'diensten'){
        const page = ctx[pageKey] || {};
        const faqs = Array.isArray(page.faq) ? page.faq : [];
        const mainEntity = faqs
          .filter(it => it && it.q && it.a)
          .map(it => ({
            "@type": "Question",
            "name": String(it.q),
            "acceptedAnswer": {"@type":"Answer","text": String(it.a)}
          }));
        if(mainEntity.length){
          const faqSchema = {
            "@context":"https://schema.org",
            "@type":"FAQPage",
            "mainEntity": mainEntity
          };
          upsertJsonLd('jsonld-faq', faqSchema);
        }
      }

    }catch(e){
      // Nooit de pagina blokkeren door JSON-LD
      console && console.debug && console.debug('jsonld skipped', e);
    }
  }

  function upsertJsonLd(id, obj, replaceSelector){
    let el = document.getElementById(id);

    if(!el && replaceSelector){
      const existing = document.querySelector(replaceSelector);
      if(existing && existing.tagName === 'SCRIPT' && existing.type === 'application/ld+json'){
        el = existing;
        el.id = id;
      }
    }

    if(!el){
      el = document.createElement('script');
      el.type = 'application/ld+json';
      el.id = id;
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(obj);
  }
  function getByPath(obj, path){
    if(!path) return undefined;
    const parts = path.split('.');
    let cur = obj;
    for(const part of parts){
      if(cur && Object.prototype.hasOwnProperty.call(cur, part)){
        cur = cur[part];
      } else {
        return undefined;
      }
    }
    return cur;
  }

  function setAriaCurrent(nav){
    const file = location.pathname.split('/').pop() || 'index.html';
    $$('a', nav).forEach(a=>{
      const href = a.getAttribute('href');
      if(href === file) a.setAttribute('aria-current','page');
    });
  }

  function renderNav(site){
    const nav = $('[data-mount="site.nav"]');
    if(!nav) return [];
    nav.innerHTML = '';
    const file = location.pathname.split('/').pop() || 'index.html';
    const navLinks = (site.nav||[]).map(item=>{
      const a = document.createElement('a');
      a.href = item.href;
      a.textContent = item.label;
      if(item.href === file) a.setAttribute('aria-current','page');
      nav.appendChild(a);
      return {label:item.label, href:item.href, current:item.href===file};
    });
    return navLinks;
  }

  function renderFooter(site){
    const links = $('[data-mount="site.footer.links"]');
    if(links){
      links.innerHTML = '';
      (site.footer?.legal_links||[]).forEach(l=>{
        const a = document.createElement('a');
        a.href = l.href;
        a.textContent = l.label;
        links.appendChild(a);
      });
    }
    // copyright placeholder replacement
    if(window.RW_APP && window.RW_APP.setYear) window.RW_APP.setYear();
  }

  function mountHome(page){
    const host = $('[data-mount="home.sections"]');
    if(!host) return;
    host.innerHTML = '';

    const sections = page.sections || [];

    for(let i = 0; i < sections.length; i += 1){
      const sec = sections[i];
      const wrap = document.createElement('div');
      wrap.className = 'block reveal home-block';

      if(sec.type === 'feature_grid' && i === 0){
        wrap.classList.add('section-open', 'home-align-right');
      }
      if(sec.type === 'feature_grid' && i > 0){
        wrap.classList.add('section-card');
      }
      if(sec.type === 'testimonials'){
        wrap.classList.add('section-open');
      }

      if(sec.type === 'feature_grid'){
        const h = document.createElement('h2');
        h.textContent = sec.title || '';
        wrap.appendChild(h);
        if(sec.subtitle){
          const p = document.createElement('p');
          p.className = 'muted';
          p.textContent = sec.subtitle;
          wrap.appendChild(p);
        }
        const grid = document.createElement('div');
        grid.className = 'grid two';
        (sec.items||[]).forEach(it=>{
          const c = document.createElement('div');
          c.className = 'card reveal';
          c.innerHTML = `<h3></h3><p class="muted"></p>`;
          c.querySelector('h3').textContent = it.title || '';
          c.querySelector('p').textContent = it.text || '';
          grid.appendChild(c);
        });
        wrap.appendChild(grid);
      }

      if(sec.type === 'price_callout'){
        wrap.classList.add('section-blue', 'home-chapter');
        const chapter = document.createElement('div');
        chapter.className = 'home-chapter-inner';

        const note = document.createElement('div');
        note.className = 'note-bar reveal';
        const badge = sec.badge ? `<span class="badge">${sec.badge}</span> ` : '';
        note.innerHTML = `${badge}<strong>${safeText(sec.title)}</strong> — ${safeText(sec.text)}`;
        chapter.appendChild(note);

        const next = sections[i + 1];
        if(next && next.type === 'process_teaser'){
          const c = document.createElement('div');
          c.className = 'card reveal chapter-process';
          const steps = (next.steps||[]).map(s=>`<span class="badge">${safeText(s)}</span>`).join(' ');
          c.innerHTML = `<h3>${safeText(next.title)}</h3><p class="muted">${safeText(next.text||'')}</p><div class="chapter-step-row">${steps}</div>`;
          const a = document.createElement('a');
          a.className = 'btn ghost';
          a.href = next.button_href || 'werkwijze.html';
          a.textContent = next.button_label || 'Bekijk werkwijze';
          c.appendChild(a);
          chapter.appendChild(c);
          i += 1;
        }

        wrap.appendChild(chapter);
      }

      if(sec.type === 'process_teaser'){
        wrap.classList.add('section-card');
        const c = document.createElement('div');
        c.className = 'card reveal';
        const steps = (sec.steps||[]).map(s=>`<span class="badge">${safeText(s)}</span>`).join(' ');
        c.innerHTML = `<h3>${safeText(sec.title)}</h3><p class="muted">${safeText(sec.text||'')}</p><div class="chapter-step-row">${steps}</div>`;
        const a = document.createElement('a');
        a.className = 'btn ghost';
        a.href = sec.button_href || 'werkwijze.html';
        a.textContent = sec.button_label || 'Bekijk werkwijze';
        c.appendChild(a);
        wrap.appendChild(c);
      }

      if(sec.type === 'projects_teaser'){
        wrap.classList.add('section-open');
        const h = document.createElement('h2');
        h.textContent = sec.title || '';
        wrap.appendChild(h);

        const intro = document.createElement('p');
        intro.className = 'muted';
        intro.textContent = sec.text || '';
        wrap.appendChild(intro);

        const list = document.createElement('div');
        list.className = 'stack';
        (sec.projects||[]).forEach(p=>{
          const row = document.createElement('div');
          row.className = 'addon-item';
          row.innerHTML = `<div class="row"><div class="name"></div><div class="price"></div></div><div class="text"></div><div style="margin-top:8px"></div>`;
          row.querySelector('.name').textContent = p.title || '';
          row.querySelector('.price').textContent = p.tag || '';
          row.querySelector('.text').textContent = p.text || '';
          const linkWrap = row.querySelector('div[style]');
          const a = document.createElement('a');
          a.className = 'small-link';
          a.href = p.href || '#';
          a.textContent = p.link_label || 'Bekijk';
          linkWrap.appendChild(a);
          list.appendChild(row);
        });
        wrap.appendChild(list);
      }

      if(sec.type === 'testimonials'){
        const h = document.createElement('h2');
        h.textContent = sec.title || '';
        wrap.appendChild(h);
        if(sec.subtitle){
          const p = document.createElement('p');
          p.className = 'muted';
          p.textContent = sec.subtitle;
          wrap.appendChild(p);
        }
        const grid = document.createElement('div');
        grid.className = 'grid two';
        (sec.items||[]).forEach(it=>{
          const c = document.createElement('div');
          c.className = 'card reveal';
          c.innerHTML = `<h3></h3><div class="t-meta muted"></div><p class="muted"></p>`;
          c.querySelector('h3').textContent = it.name || 'Klant';

          const meta = it.meta || [it.role, it.company].filter(Boolean).join(' • ');
          const metaEl = c.querySelector('.t-meta');
          if(meta){
            metaEl.textContent = meta;
            metaEl.hidden = false;
          } else {
            metaEl.hidden = true;
          }

          c.querySelector('p').textContent = it.text || '';
          grid.appendChild(c);
        });
        wrap.appendChild(grid);
      }

      if(sec.type === 'faq'){
        wrap.classList.add('section-open', 'home-align-right');
        const h = document.createElement('h2');
        h.textContent = safeText(sec.title);
        wrap.appendChild(h);
        if(sec.subtitle){
          const p = document.createElement('p');
          p.className = 'muted';
          p.textContent = sec.subtitle;
          wrap.appendChild(p);
        }
        const list = document.createElement('div');
        list.className = 'faq faq-open';
        (sec.items||[]).forEach(it=>{
          const row = document.createElement('div');
          row.className = 'faq-item';
          row.innerHTML = `<p class="q"></p><p class="a"></p>`;
          row.querySelector('.q').textContent = it.q || '';
          row.querySelector('.a').textContent = it.a || '';
          list.appendChild(row);
        });
        wrap.appendChild(list);
      }

      if(sec.type === 'cta'){
        wrap.classList.add('section-blue');
        const band = document.createElement('section');
        band.className = 'cta-band reveal';
        band.innerHTML = `<div class="cta-inner"><h3></h3><p class="muted"></p></div>`;
        band.querySelector('h3').textContent = sec.title || '';
        band.querySelector('p').textContent = sec.text || '';
        const a = document.createElement('a');
        a.className = 'btn primary';
        a.href = sec.button_href || 'contact.html';
        a.textContent = sec.button_label || 'Offerte aanvragen';
        band.appendChild(a);
        wrap.appendChild(band);
      }

      host.appendChild(wrap);
    }
  }

function mountDiensten(page){
  // Deliverables
  const ul = $('[data-mount="diensten.deliverables"]');
  if(ul){
    ul.innerHTML = '';
    (page.deliverables||[]).forEach(t=>{
      const li = document.createElement('li');
      li.textContent = t;
      ul.appendChild(li);
    });
  }

  // Expectations (optional, backward-compatible)
  const exp = document.querySelector('[data-mount="diensten.expectations"]');
  if(exp){
    exp.innerHTML = '';
    (page.expectations?.items||[]).forEach(t=>{
      const li = document.createElement('li');
      li.textContent = t;
      exp.appendChild(li);
    });
  }

  // Add-ons
  const addons = $('[data-mount="diensten.addons.items"]');
  if(addons){
    addons.innerHTML = '';
    (page.addons?.items||[]).forEach(a=>{
      const el = document.createElement('div');
      el.className = 'addon-item reveal';
      el.innerHTML = `<div class="row"><div class="name"></div><div class="price"></div></div><div class="text"></div>`;
      el.querySelector('.name').textContent = a.name || '';
      el.querySelector('.price').textContent = a.price || '';
      el.querySelector('.text').textContent = a.text || '';
      addons.appendChild(el);
    });
  }

  // ---- Prijsindicator (CSS-based) ----
  const pricingHost = document.querySelector('[data-mount="diensten.pricing"]');
  if(pricingHost){
    pricingHost.innerHTML = '';

    // Alleen renderen als pricing bestaat (niet returnen -> rest blijft werken)
    if(page.pricing){
      const basePrice = Number(page.pricing.base_price || 0);
      const options = (page.pricing.use_addons_as_options ? (page.addons?.items || []) : []);

      const wrap = document.createElement('div');
      wrap.className = 'price-indicator';

      // Basisregel
      const baseRow = document.createElement('div');
      baseRow.className = 'price-row price-base';
      baseRow.innerHTML = `
        <div class="price-row-top">
          <div class="price-name">${page.pricing.base_label || 'Basiswebsite'}</div>
          <div class="price-amount">€${basePrice}</div>
        </div>
        <div class="price-desc">Inclusief 5 pagina’s, responsive ontwerp, contactformulier en CMS.</div>
      `;
      wrap.appendChild(baseRow);

      // Opties
      const list = document.createElement('div');
      list.className = 'price-options';

      // helper: "€35" -> 35
      const euroToNumber = (s) => {
        const n = String(s || '').replace(/[^\d,.-]/g, '').replace(',', '.');
        const val = Number(n);
        return Number.isFinite(val) ? val : 0;
      };

      const totalRow = document.createElement('div');
      totalRow.className = 'note-bar price-total';

      const renderTotal = () => {
        let selected = 0;
        list.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
          if (cb.checked) selected += Number(cb.getAttribute('data-price') || 0);
        });
        totalRow.innerHTML = `<strong>Totaal indicatie:</strong> €${basePrice + selected}`;
      };

      options.forEach((opt, idx) => {
        const priceNum = euroToNumber(opt.price);
        const id = `price-opt-${idx}`;

        const item = document.createElement('label');
        item.className = 'price-option';
        item.setAttribute('for', id);

        item.innerHTML = `
          <input class="price-check" type="checkbox" id="${id}" data-price="${priceNum}" />
          <div class="price-option-body">
            <div class="price-option-title">
              <span class="price-option-name">${opt.name || ''}</span>
              <span class="price-option-price">${opt.price || ''}</span>
            </div>
            <div class="price-option-text">${opt.text || ''}</div>
          </div>
        `;

        item.querySelector('input').addEventListener('change', renderTotal);
        list.appendChild(item);
      });

      wrap.appendChild(list);
      wrap.appendChild(totalRow);

      pricingHost.appendChild(wrap);
      renderTotal();
    }
  }
  // -----------------------------------
  // Social proof (optional)
  const sp = document.querySelector('[data-mount="diensten.social_proof"]');
  if(sp){
    sp.innerHTML = '';
    const data = page.social_proof;
    if(data){
      const badge = data.badge ? `<span class="badge">${data.badge}</span> ` : '';
      const title = data.title ? `<strong>${data.title}</strong>` : '';
      const subtitle = data.subtitle ? ` — ${data.subtitle}` : '';
      const stats = data.stats ? ` <span class="muted">${data.stats}</span>` : '';
      sp.innerHTML = `${badge}${title}${subtitle}${stats}`;
      if(Array.isArray(data.items) && data.items.length){
        const list = document.createElement('div');
        list.style.marginTop = '10px';
        data.items.forEach(it=>{
          const row = document.createElement('div');
          row.className = 'addon-item';
          row.innerHTML = `<div class="row"><div class="name"></div><div class="price"></div></div><div class="text"></div>`;
          row.querySelector('.name').textContent = it.name || '';
          row.querySelector('.price').textContent = it.meta || '';
          row.querySelector('.text').textContent = it.text || '';
          list.appendChild(row);
        });
        sp.appendChild(list);
      }
    }
  }

  // FAQ
  const faq = $('[data-mount="diensten.faq"]');
  if(faq){
    faq.innerHTML = '';
    (page.faq||[]).forEach(it=>{
      const el = document.createElement('div');
      el.className = 'faq-item';
      el.innerHTML = `<p class="q"></p><p class="a"></p>`;
      el.querySelector('.q').textContent = it.q || '';
      el.querySelector('.a').textContent = it.a || '';
      faq.appendChild(el);
    });
  }
}

function mountWerkwijze(page){
  // Steps
  const steps = $('[data-mount="werkwijze.steps"]');
  if(steps){
    steps.innerHTML = '';
    (page.steps||[]).forEach(s=>{
      const el = document.createElement('div');
      el.className = 'step reveal';
      el.innerHTML = `<p class="t"></p><p class="p"></p>`;
      el.querySelector('.t').textContent = s.title || '';
      el.querySelector('.p').textContent = s.text || '';
      steps.appendChild(el);
    });
  }

  // Wat u nodig heeft (need)
  const need = $('[data-mount="werkwijze.need.items"]');
  if(need){
    need.innerHTML = '';
    (page.need?.items||[]).forEach(t=>{
      const li = document.createElement('li');
      li.textContent = t;
      need.appendChild(li);
    });
  }

  // Regels / afspraken (rules)
  const rules = $('[data-mount="werkwijze.rules.items"]');
  if(rules){
    rules.innerHTML = '';
    (page.rules?.items||[]).forEach(t=>{
      const li = document.createElement('li');
      li.textContent = t;
      rules.appendChild(li);
    });
  }

  // Platforms (platforms)
  const platforms = $('[data-mount="werkwijze.platforms.items"]');
  if(platforms){
    platforms.innerHTML = '';
    (page.platforms?.items||[]).forEach(t=>{
      const li = document.createElement('li');
      li.textContent = t;
      platforms.appendChild(li);
    });
  }

  // NIEUW: extra (extra.items)
  const extra = $('[data-mount="werkwijze.extra.items"]');
  if(extra){
    extra.innerHTML = '';
    (page.extra?.items||[]).forEach(t=>{
      const li = document.createElement('li');
      li.textContent = t;
      extra.appendChild(li);
    });
  }
    // CTA buttons (werkwijze.cta.buttons)
  const ctaButtonsHost = document.querySelector('[data-mount="werkwijze.cta.buttons"]');
  if(ctaButtonsHost){
    ctaButtonsHost.innerHTML = '';

    const buttons = page.cta?.buttons || [];
    buttons.forEach((b) => {
      const a = document.createElement('a');

      // style: "primary" of "ghost" (default ghost)
      const style = (b.style || 'ghost').toLowerCase().trim();
      a.className = `btn ${style === 'primary' ? 'primary' : 'ghost'}`;

      a.href = b.href || '#';
      a.textContent = b.label || 'Open';

      ctaButtonsHost.appendChild(a);
    });
  }
}

  function mountProjecten(page){
    const grid = $('[data-mount="projecten.projects"]');
    if(!grid) return;
    grid.innerHTML = '';
    (page.projects||[]).forEach(p=>{
      const card = document.createElement('div');
      card.className = 'card project-card reveal';
      card.innerHTML = `
        <div class="project-media"><img alt=""></div>
        <div class="project-body">
          <div class="badge"></div>
          <h3 class="project-title"></h3>
          <p class="project-text"></p>
          <div class="project-context" data-slot="project-context"></div>
          <a class="small-link" target="_blank" rel="noopener noreferrer"></a>
        </div>
      `;
      card.querySelector('.badge').textContent = p.tag || '';
      card.querySelector('.project-title').textContent = p.title || '';
      card.querySelector('.project-text').textContent = p.text || '';
      const ctx = card.querySelector('[data-slot="project-context"]');
      if(ctx){
        const parts = [];
        if(p.goal) parts.push(`Doel: ${p.goal}`);
        if(p.work) parts.push(`Werk: ${p.work}`);
        if(p.result) parts.push(`Resultaat: ${p.result}`);
        ctx.textContent = parts.join(' · ');
        if(!ctx.textContent) ctx.remove();
      }
      const img = card.querySelector('img');
      img.src = p.image || 'assets/img/placeholder/project-1.svg';
      img.alt = p.image_alt || '';
      const a = card.querySelector('a');
      a.href = p.href || '#';
      a.textContent = p.link_label || 'Bekijk';
      grid.appendChild(card);
    });
  }

  function mountContact(page){
    const steps = $('[data-mount="contact.after.steps"]');
    if(steps){
      steps.innerHTML = '';
      (page.after?.steps||[]).forEach(s=>{
        const li = document.createElement('li');
        li.textContent = s;
        steps.appendChild(li);
      });
    }
    const cards = $('[data-mount="contact.cards"]');
    if(cards){
      cards.innerHTML = '';
      (page.cards||[]).forEach(c=>{
        const el = document.createElement('div');
        el.className = 'addon-item reveal';
        el.innerHTML = `<div class="row"><div class="name"></div><div class="price"></div></div><div class="text"></div><div data-slot="link" style="margin-top:8px"></div>`;
        el.querySelector('.name').textContent = c.title || '';
        el.querySelector('.price').textContent = '';
        el.querySelector('.text').textContent = c.text || '';
        const wrap = el.querySelector('[data-slot="link"]');
        const url = (c.link_url||'').toString().trim();
        if(url){
          const a = document.createElement('a');
          a.className = 'small-link';
          a.href = url;
          a.textContent = (c.link_label||'Open').toString().trim() || 'Open';
          wrap.appendChild(a);
        }
        cards.appendChild(el);
      });
    }

    // Form reassurance (optional)
    const r = document.querySelector('[data-mount="contact.form.reassurance"]');
    if(r){
      r.innerHTML = '';
      (page.form?.reassurance||[]).forEach(t=>{
        const li = document.createElement('li');
        li.textContent = t;
        r.appendChild(li);
      });
    }

    // Privacy note with link (optional)
    const pn = document.querySelector('[data-mount="contact.form.privacy_note"]');
    if(pn){
      pn.innerHTML = '';
      const note = page.form?.privacy_note;
      if(note){
        const span = document.createElement('span');
        span.textContent = (note.text||'').toString().trim();
        pn.appendChild(span);
        const href = (note.link_href||'').toString().trim();
        const label = (note.link_label||'').toString().trim();
        if(href && label){
          const a = document.createElement('a');
          a.href = href;
          a.textContent = label;
          a.className = "small-link";
          pn.appendChild(document.createTextNode(" "));
          pn.appendChild(a);
        }
      }
    }
  }

function mountLegal(page){
  // 1) NIEUW: sections renderer (privacy.sections / cookies.sections)
  const sectionsHost =
    document.querySelector('[data-mount="privacy.sections"]') ||
    document.querySelector('[data-mount="cookies.sections"]');

  if(sectionsHost){
    sectionsHost.innerHTML = '';

    (page.sections || []).forEach(sec => {
      const card = document.createElement('div');
      card.className = 'card reveal';

      // Titel
      if(sec.title){
        const h = document.createElement('h3');
        h.textContent = sec.title;
        card.appendChild(h);
      }

      // Tekst
      if(sec.text){
        const p = document.createElement('p');
        p.className = 'muted';
        p.textContent = sec.text;
        card.appendChild(p);
      }

      // Bullets
      if(Array.isArray(sec.bullets) && sec.bullets.length){
        const ul = document.createElement('ul');
        ul.className = 'bullets';
        sec.bullets.forEach(b => {
          const li = document.createElement('li');
          li.textContent = b;
          ul.appendChild(li);
        });
        card.appendChild(ul);
      }

      sectionsHost.appendChild(card);
    });

    return; // klaar, niet doorgaan naar oude renderer
  }

  // 2) OUDE fallback: legal.body renderer (als je ooit weer teruggaat naar dat systeem)
  const host = $('.legal[data-mount="legal.body"]');
  if(!host) return;

  host.innerHTML = '';
  (page.body||[]).forEach(b=>{
    if(b.type === 'heading'){
      const h = document.createElement('h2');
      h.textContent = b.text || '';
      host.appendChild(h);
    }
    if(b.type === 'paragraph'){
      const p = document.createElement('p');
      p.textContent = b.text || '';
      host.appendChild(p);
    }
    if(b.type === 'list'){
      const ul = document.createElement('ul');
      ul.className = 'bullets';
      (b.items||[]).forEach(it=>{
        const li = document.createElement('li');
        li.textContent = it;
        ul.appendChild(li);
      });
      host.appendChild(ul);
    }
  });
}

async function buildSearchIndex(site, pages){
    // Create a basic search index across known pages and project titles/descriptions
    const items = [];

    const results = await Promise.all(
      pages.map(key =>
        fetchJSON(`content/${key}.json`, site.github_fallback)
          .then(page => ({ key, page }))
          .catch(() => null)
      )
    );

    for(const entry of results){
      if(!entry) continue;
      const { key, page } = entry;

      items.push({
        key,
        title: page.page?.title || key,
        snippet: page.page?.subtitle || '',
        href: key === 'home' ? 'index.html' : `${key}.html`,
        text: JSON.stringify(page)
      });

      if(key === 'projecten'){
        (page.projects||[]).forEach(p=>{
          items.push({
            key: 'project',
            title: p.title || 'Project',
            snippet: p.text || '',
            href: p.href || 'projecten.html',
            text: `${p.title||''} ${p.text||''} ${p.tag||''}`
          });
        });
      }
    }

    return items;
  }

  function normalize(str){
    return (str||'')
      .toString()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'')
      .trim();
  }

  async function init(){
    const key = getKey();
    const site = await fetchJSON('content/site.json', null);
    const page = await fetchJSON(`content/${key}.json`, site.github_fallback);

    // build unified context: {site, [key]: page}
    const ctx = {site};
    ctx[key] = page;

    bindSimple(document, ctx);
    injectJsonLd(ctx, key);

    const navLinks = renderNav(site);
    renderFooter(site);

    // menu + reveal
    if(window.RW_APP){
      window.RW_APP.setupMobileNav(navLinks);
      window.RW_APP.setupReveal();
    }

    // Search index
    const pageKeys = ['home','diensten','werkwijze','projecten','contact','privacy','cookies'];
    const index = await buildSearchIndex(site, pageKeys);

    // Setup overlay open/close and search behavior
    const overlay = $('[data-ui="search"]');
    const input = $('[data-search="input"]');
    const results = $('[data-search="results"]');

    const renderHits = (hits) => {
      if(!results) return;
      results.innerHTML = '';
      if(!hits.length){
        const div = document.createElement('div');
        div.className = 'muted';
        div.textContent = 'Geen resultaten.';
        results.appendChild(div);
        return;
      }
      hits.slice(0, 12).forEach(h=>{
        const a = document.createElement('a');
        a.className = 'search-hit';
        a.href = h.href;
        a.innerHTML = `<p class="t"></p><p class="s"></p>`;
        a.querySelector('.t').textContent = h.title;
        a.querySelector('.s').textContent = h.snippet || '';
        results.appendChild(a);
      });
    };

    const doSearch = () => {
      if(!input) return;
      const q = normalize(input.value);
      if(!q){ renderHits([]); return; }
      const hits = index.filter(it => normalize(it.title+' '+it.snippet+' '+it.text).includes(q));
      renderHits(hits);
    };

    if(input) input.addEventListener('input', doSearch);

    const openSearch = () => {
      if(!overlay) return;
      overlay.hidden = false;
      document.body.style.overflow = 'hidden';
      if(input){
        input.value = '';
        input.focus();
      }
      renderHits([]);
    };

    const closeSearch = () => {
      if(!overlay) return;
      overlay.hidden = true;
      document.body.style.overflow = '';
      if(input) input.blur();
    };

    if(window.RW_APP){
      window.RW_APP.setupSearchUI(openSearch, closeSearch);
    }

    // Page-specific mounts
    if(key === 'home') mountHome(page);
    if(key === 'diensten') mountDiensten(page);
    if(key === 'werkwijze') mountWerkwijze(page);
    if(key === 'projecten') mountProjecten(page);
    if(key === 'contact') mountContact(page);
    if(key === 'privacy' || key === 'cookies') mountLegal(page);

    // Re-run reveal observer for dynamically mounted content
    if(window.RW_APP && window.RW_APP.setupReveal) window.RW_APP.setupReveal();

    // Mark current in nav
    const nav = $('[data-mount="site.nav"]');
    if(nav) setAriaCurrent(nav);
    // Header CTA (site default, with optional per-page override)
    const cta = $('.header-cta');
    if(cta){
      const override = (page && page.page && page.page.header_cta) ? page.page.header_cta : null;
      const label = (override && override.label) ? override.label : (site.cta?.primary_label || 'Offerte aanvragen');
      const href  = (override && override.href) ? override.href : (site.cta?.primary_href || 'contact.html');
      const variant = (override && override.variant) ? override.variant : 'primary';
      cta.textContent = label;
      cta.href = href;
      cta.classList.remove('primary','ghost');
      cta.classList.add(variant === 'ghost' ? 'ghost' : 'primary');
    }
  }

  if(window.RW_APP && window.RW_APP.onReady){
    window.RW_APP.onReady(()=>init().catch(console.error));
  } else {
    document.addEventListener('DOMContentLoaded', ()=>init().catch(console.error));
  }
})();

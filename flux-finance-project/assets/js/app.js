let barChart = null;
    let pieChart = null;

    // ============ STORAGE FUNCTIONS ============
    function db() {
      try {
        return window.localStorage;
      } catch (e) {
        return null;
      }
    }

    function getUsers() {
      try {
        return JSON.parse(db().getItem('ffUsers') || '{}');
      } catch (e) {
        return {};
      }
    }

    function saveUsers(u) {
      db().setItem('ffUsers', JSON.stringify(u));
    }

    function getCurrentUser() {
      try {
        return db().getItem('ffCurrentUser');
      } catch (e) {
        return null;
      }
    }

    function setCurrentUser(email) {
      db().setItem('ffCurrentUser', email);
    }

    function getTxns(email) {
      try {
        return JSON.parse(db().getItem('ffTxns_' + email) || '[]');
      } catch (e) {
        return [];
      }
    }

    function saveTxns(email, txns) {
      db().setItem('ffTxns_' + email, JSON.stringify(txns));
    }

    // ============ AUTH FUNCTIONS ============
    function switchTab(tab) {
      document.querySelectorAll('.auth-tab').forEach((t, i) => {
        t.classList.toggle('active', (i === 0 && tab === 'login') || (i === 1 && tab === 'register'));
      });
      document.getElementById('login-form').style.display = tab === 'login' ? '' : 'none';
      document.getElementById('register-form').style.display = tab === 'register' ? '' : 'none';
      document.getElementById('auth-err').classList.remove('show');
    }

    function showErr(msg) {
      const el = document.getElementById('auth-err');
      el.textContent = msg;
      el.classList.add('show');
    }

    function doLogin() {
      const email = document.getElementById('l-email').value.trim().toLowerCase();
      const pass = document.getElementById('l-pass').value;
      if (!email || !pass) return showErr('Preencha todos os campos.');
      const users = getUsers();
      if (!users[email] || users[email].pass !== btoa(pass)) return showErr('E-mail ou senha incorretos.');
      setCurrentUser(email);
      enterDash(users[email].name, email);
    }

    function doRegister() {
      const name = document.getElementById('r-name').value.trim();
      const email = document.getElementById('r-email').value.trim().toLowerCase();
      const pass = document.getElementById('r-pass').value;
      if (!name || !email || !pass) return showErr('Preencha todos os campos.');
      if (pass.length < 6) return showErr('Senha deve ter no mínimo 6 caracteres.');
      const users = getUsers();
      if (users[email]) return showErr('Este e-mail já está cadastrado.');
      users[email] = { name, pass: btoa(pass) };
      saveUsers(users);
      setCurrentUser(email);
      enterDash(name, email);
    }

    function enterDash(name, email) {
      document.getElementById('screen-auth').classList.remove('active');
      document.getElementById('screen-dash').classList.add('active');
      document.getElementById('user-name').textContent = name;
      const initials = name
        .split(' ')
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
      document.getElementById('user-avatar').textContent = initials;
      updateMetrics(email);
      renderTable();
      renderCharts(email);
    }

    function doLogout() {
      db().removeItem('ffCurrentUser');
      document.getElementById('screen-dash').classList.remove('active');
      document.getElementById('screen-auth').classList.add('active');
      document.getElementById('l-email').value = '';
      document.getElementById('l-pass').value = '';
      document.getElementById('r-name').value = '';
      document.getElementById('r-email').value = '';
      document.getElementById('r-pass').value = '';
    }

    // ============ METRICS & DISPLAY ============
    function fmtBRL(v) {
      return (
        'R$ ' +
        Math.abs(v).toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      );
    }

    function updateMetrics(email) {
      email = email || getCurrentUser();
      const txns = getTxns(email);
      let cred = 0,
        deb = 0;
      txns.forEach((t) => {
        if (t.type === 'credit') cred += t.amount;
        else deb += t.amount;
      });
      const saldo = cred - deb;
      document.getElementById('m-saldo').textContent = fmtBRL(saldo);
      document.getElementById('m-saldo').className = 'metric-val' + (saldo >= 0 ? ' positive' : ' negative');
      document.getElementById('m-cred').textContent = fmtBRL(cred);
      document.getElementById('m-deb').textContent = fmtBRL(deb);
      document.getElementById('m-count').textContent = txns.length;
    }

    function renderTable() {
      const email = getCurrentUser();
      const txns = getTxns(email);
      const search = (document.getElementById('search-input').value || '').toLowerCase();
      const ftype = document.getElementById('filter-type').value;
      const filtered = txns.filter((t) => {
        const matchType = ftype === 'all' || t.type === ftype;
        const matchSearch = !search || t.description.toLowerCase().includes(search) || t.date.includes(search);
        return matchType && matchSearch;
      });
      const body = document.getElementById('table-body');
      if (!filtered.length) {
        body.innerHTML =
          '<div class="empty-state"><i class="ti ti-search"></i>' +
          (txns.length ? 'Nenhuma transação encontrada.' : 'Importe um extrato CSV para começar') +
          '</div>';
        return;
      }
      const rows = filtered
        .slice()
        .reverse()
        .slice(0, 100)
        .map(
          (t) => `
        <tr>
          <td>${t.date}</td>
          <td>${t.description}</td>
          <td style="text-align:right;font-variant-numeric:tabular-nums;color:${t.type === 'credit' ? '#0F6E56' : '#993C1D'}">${t.type === 'credit' ? '+' : '-'}${fmtBRL(t.amount)}</td>
          <td><span class="badge ${t.type === 'credit' ? 'credit' : 'debit'}">${t.type === 'credit' ? 'Crédito' : 'Débito'}</span></td>
        </tr>`
        )
        .join('');
      body.innerHTML = `<table><thead><tr><th>Data</th><th>Descrição</th><th style="text-align:right">Valor</th><th>Tipo</th></tr></thead><tbody>${rows}</tbody></table>`;
    }

    function renderCharts(email) {
      email = email || getCurrentUser();
      const txns = getTxns(email);
      const monthMap = {};
      txns.forEach((t) => {
        const key = t.date.substring(0, 7);
        if (!monthMap[key]) monthMap[key] = { credit: 0, debit: 0 };
        if (t.type === 'credit') monthMap[key].credit += t.amount;
        else monthMap[key].debit += t.amount;
      });
      const months = Object.keys(monthMap).sort().slice(-6);
      const labels = months.map((m) => {
        const [y, mo] = m.split('-');
        return ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][parseInt(mo) - 1] + '/' + y.slice(2);
      });
      const credData = months.map((m) => parseFloat(monthMap[m].credit.toFixed(2)));
      const debData = months.map((m) => parseFloat(monthMap[m].debit.toFixed(2)));

      if (barChart) barChart.destroy();
      const barCtx = document.getElementById('barChart').getContext('2d');
      barChart = new Chart(barCtx, {
        type: 'bar',
        data: {
          labels: labels.length ? labels : ['Sem dados'],
          datasets: [
            { label: 'Créditos', data: credData.length ? credData : [0], backgroundColor: '#5DCAA5', borderRadius: 6 },
            { label: 'Débitos', data: debData.length ? debData : [0], backgroundColor: '#F0997B', borderRadius: 6 },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { font: { size: 11 }, color: '#9A9A9A' }, grid: { display: false } },
            y: {
              ticks: {
                font: { size: 11 },
                color: '#9A9A9A',
                callback: (v) => 'R$' + (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v),
              },
              grid: { color: 'rgba(200, 200, 200, 0.1)' },
            },
          },
        },
      });

      let totalCred = 0,
        totalDeb = 0;
      txns.forEach((t) => {
        if (t.type === 'credit') totalCred += t.amount;
        else totalDeb += t.amount;
      });
      if (pieChart) pieChart.destroy();
      const pieCtx = document.getElementById('pieChart').getContext('2d');
      pieChart = new Chart(pieCtx, {
        type: 'doughnut',
        data: {
          labels: ['Créditos', 'Débitos'],
          datasets: [
            {
              data: [parseFloat(totalCred.toFixed(2)), parseFloat(totalDeb.toFixed(2))],
              backgroundColor: ['#5DCAA5', '#F0997B'],
              borderWidth: 0,
              hoverOffset: 4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '65%',
          plugins: {
            legend: {
              display: true,
              position: 'bottom',
              labels: { font: { size: 11 }, color: '#9A9A9A', boxWidth: 10, padding: 12 },
            },
          },
        },
      });
    }

    // ============ CSV PARSING ============
    function parseCSV(text) {
      const lines = text.trim().split(/\r?\n/);
      if (lines.length < 2) return [];
      const headers = lines[0].split(/[,;]/).map((h) => h.trim().toLowerCase().replace(/['"]/g, ''));

      const findCol = (...names) => {
        for (const n of names) {
          const i = headers.findIndex((h) => h.includes(n));
          if (i >= 0) return i;
        }
        return -1;
      };
      const dateIdx = findCol('data', 'date');
      const descIdx = findCol('descri', 'description', 'desc', 'histor', 'memo', 'narr');
      const valIdx = findCol('valor', 'value', 'amount', 'quantia', 'montante', 'vlr');
      const typeIdx = findCol('tipo', 'type', 'lancamento');

      const txns = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(/[,;]/).map((c) => c.trim().replace(/^["']|["']$/g, ''));
        if (cols.length < 2) continue;
        const rawVal = valIdx >= 0 ? cols[valIdx] : '';
        const rawDate = dateIdx >= 0 ? cols[dateIdx] : '';
        const rawDesc =
          descIdx >= 0 ? cols[descIdx] : cols.filter((_, j) => j !== valIdx && j !== dateIdx).join(' ');
        const rawType = typeIdx >= 0 ? cols[typeIdx] : '';
        if (!rawVal) continue;
        const numStr = rawVal.replace(/\./g, '').replace(',', '.').replace(/[^\d.\-+]/g, '');
        const amount = parseFloat(numStr);
        if (isNaN(amount) || amount === 0) continue;
        let type;
        if (rawType) {
          type = /cred|entrada|receb|\+/i.test(rawType) ? 'credit' : 'debit';
        } else {
          type = amount >= 0 ? 'credit' : 'debit';
        }
        txns.push({ date: rawDate || '—', description: rawDesc || 'Sem descrição', amount: Math.abs(amount), type });
      }
      return txns;
    }

    function showToast(msg) {
      const t = document.getElementById('toast');
      t.textContent = msg;
      t.classList.add('show');
      setTimeout(() => t.classList.remove('show'), 2800);
    }

    function handleFile(event) {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => processCSV(e.target.result, file.name);
      reader.readAsText(file, 'utf-8');
      event.target.value = '';
    }

    function handleDrop(event) {
      event.preventDefault();
      document.getElementById('drop-zone').classList.remove('drag');
      const file = event.dataTransfer.files[0];
      if (!file || !file.name.endsWith('.csv')) {
        showToast('Por favor, envie um arquivo .csv');
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => processCSV(e.target.result, file.name);
      reader.readAsText(file, 'utf-8');
    }

    function processCSV(text, name) {
      const txns = parseCSV(text);
      if (!txns.length) {
        showToast('Nenhuma transação encontrada no arquivo.');
        return;
      }
      const email = getCurrentUser();
      const existing = getTxns(email);
      const merged = [...existing, ...txns];
      saveTxns(email, merged);
      updateMetrics(email);
      renderTable();
      renderCharts(email);
      showToast(`${txns.length} transações importadas de ${name}`);
    }

    function clearData() {
      if (!confirm('Limpar todas as transações desta conta?')) return;
      const email = getCurrentUser();
      saveTxns(email, []);
      updateMetrics(email);
      renderTable();
      renderCharts(email);
      showToast('Dados limpos com sucesso');
    }

    // ============ INIT ============
    (function init() {
      const email = getCurrentUser();
      if (email) {
        const users = getUsers();
        if (users[email]) {
          enterDash(users[email].name, email);
        }
      }
    })();
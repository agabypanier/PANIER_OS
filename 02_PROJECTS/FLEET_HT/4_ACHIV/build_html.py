import os

html_header = """<!DOCTYPE html>
<html lang="ht">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Plan Biznis FleetHT - Konplè</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        :root {
            --primary-color: #1e3a8a;
            --secondary-color: #f59e0b;
            --text-color: #333333;
            --bg-color: #f9fafb;
            --card-bg: #ffffff;
            --border-color: #e5e7eb;
        }

        body {
            font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: var(--text-color);
            background-color: var(--bg-color);
            margin: 0;
            padding: 0;
        }

        .container {
            max-width: 900px;
            margin: 0 auto;
            background: var(--card-bg);
            padding: 50px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.05);
        }

        h1, h2, h3, h4 {
            color: var(--primary-color);
            margin-top: 1.5em;
        }

        h1 { font-size: 2.5em; text-align: center; border-bottom: 4px solid var(--primary-color); padding-bottom: 20px; }
        h2 { border-bottom: 2px solid var(--secondary-color); padding-bottom: 10px; page-break-after: avoid; margin-top: 2.5em; }

        table {
            width: 100%;
            border-collapse: collapse;
            margin: 25px 0;
            font-size: 0.95em;
            box-shadow: 0 0 20px rgba(0, 0, 0, 0.05);
            page-break-inside: auto;
        }
        
        tr { page-break-inside: avoid; page-break-after: auto; }

        table thead tr {
            background-color: var(--primary-color);
            color: #ffffff;
            text-align: left;
        }

        table th, table td {
            padding: 12px 15px;
            border-bottom: 1px solid var(--border-color);
        }

        table tbody tr:nth-of-type(even) {
            background-color: #f3f4f6;
        }

        blockquote {
            background-color: #fffbeb;
            border-left: 5px solid var(--secondary-color);
            padding: 15px 20px;
            margin: 20px 0;
            border-radius: 4px;
        }

        code {
            background-color: #f1f5f9;
            padding: 2px 5px;
            border-radius: 3px;
            font-family: monospace;
        }

        pre {
            background-color: #f1f5f9;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
        }

        .chart-container {
            width: 100%;
            max-width: 800px;
            margin: 40px auto;
            background: white;
            padding: 20px;
            border-radius: 8px;
            border: 1px solid var(--border-color);
            box-sizing: border-box;
            page-break-inside: avoid;
        }

        @media print {
            body { background: white; }
            .container { box-shadow: none; padding: 0; max-width: 100%; }
            canvas { max-width: 100%; height: auto !important; }
            h2 { page-break-before: auto; }
            h2:nth-of-type(4), h2:nth-of-type(8) { page-break-before: always; }
        }
    </style>
</head>
<body>

<div class="container" id="content">
"""

html_footer = """
</div>

<script>
    // Inject Canvas for charts
    const budgetHeader = Array.from(document.querySelectorAll('h3')).find(el => el.textContent.includes('4.1'));
    if(budgetHeader) {
        const canvasDiv = document.createElement('div');
        canvasDiv.className = 'chart-container';
        canvasDiv.innerHTML = '<canvas id="budgetChart"></canvas>';
        let nextSibling = budgetHeader.nextElementSibling;
        while(nextSibling && nextSibling.tagName !== 'TABLE') {
            nextSibling = nextSibling.nextElementSibling;
        }
        if(nextSibling) {
            nextSibling.parentNode.insertBefore(canvasDiv, nextSibling.nextSibling);
        }
    }

    const growthHeader = Array.from(document.querySelectorAll('h3')).find(el => el.textContent.includes('4.5'));
    if(growthHeader) {
        const canvasDiv = document.createElement('div');
        canvasDiv.className = 'chart-container';
        canvasDiv.innerHTML = '<canvas id="growthChart"></canvas>';
        let nextSibling = growthHeader.nextElementSibling;
        while(nextSibling && nextSibling.tagName !== 'TABLE') {
            nextSibling = nextSibling.nextElementSibling;
        }
        if(nextSibling) {
            nextSibling.parentNode.insertBefore(canvasDiv, nextSibling.nextSibling);
        }
    }

    // Render Charts
    setTimeout(() => {
        if(document.getElementById('budgetChart')) {
            new Chart(document.getElementById('budgetChart').getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: ['2x Moto Nèf', 'Imatrikilasyon/Asirans', 'GPS Trackers', 'Fon Ijans'],
                    datasets: [{
                        data: [2200, 200, 100, 100],
                        backgroundColor: ['#1e3a8a', '#f59e0b', '#10b981', '#6b7280'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        title: { display: true, text: 'Repatisyon Bidjè Inisyal ($2,600 USD)', font: { size: 18 } }
                    }
                }
            });
        }

        if(document.getElementById('growthChart')) {
            new Chart(document.getElementById('growthChart').getContext('2d'), {
                type: 'line',
                data: {
                    labels: ['Mwa 1', 'Mwa 2', 'Mwa 3', 'Mwa 4', 'Mwa 5', 'Mwa 6', 'Mwa 7', 'Mwa 8', 'Mwa 9', 'Mwa 10', 'Mwa 11', 'Mwa 12', 'Mwa 13', 'Mwa 14'],
                    datasets: [{
                        label: 'Kantite Moto nan lari a',
                        data: [2, 2, 2, 3, 3, 3, 4, 4, 5, 5, 6, 7, 7, 8],
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245, 158, 11, 0.2)',
                        borderWidth: 3,
                        tension: 0.3,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        title: { display: true, text: 'Kwasans Flòt la sou 14 Mwa', font: { size: 16 } }
                    }
                }
            });
        }
    }, 500);
</script>
</body>
</html>
"""

body_path = r'c:\Users\0000\AGABY_2026\02_PROJECTS\FLEET_HT\pwoje_body.html'
out_path = r'c:\Users\0000\AGABY_2026\02_PROJECTS\FLEET_HT\PWOJE_FLEETHT_PRO.html'

with open(body_path, 'r', encoding='utf-8') as f:
    body = f.read()

with open(out_path, 'w', encoding='utf-8') as f:
    f.write(html_header + body + html_footer)

print("Done")

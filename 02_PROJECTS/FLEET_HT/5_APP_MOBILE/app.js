// Konfigirasyon Supabase (Sèvi ak menm URL ak Kle w gen nan Python nan)
const SUPABASE_URL = 'https://dqnrhzcfhdhzlszzpujc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxbnJoemNmaGRoemxzenpwdWpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MTE2NTIsImV4cCI6MjA5MzM4NzY1Mn0.7gOnjgTVM-_7fV5eEHCHFgwm_mzsUtOQcYZ0kODjy98';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Fonksyon pou chanje paj nan app la
function switchTab(tabId, title, element) {
    // Chanje Tit la
    document.getElementById('page-title').innerText = title;
    
    // Kache tout kontni yo
    document.querySelectorAll('.page-content').forEach(el => {
        el.classList.remove('active');
    });
    
    // Retire koulè ble sou tout bouton anba yo
    document.querySelectorAll('.tab-item').forEach(el => {
        el.classList.remove('active');
        // chanje icon yo an outline
        let icon = el.querySelector('ion-icon');
        if(icon.name && !icon.name.includes('-outline') && icon.name !== 'document-text' && icon.name !== 'wallet' && icon.name !== 'bicycle') {
            // just basic styling
        }
    });
    
    // Aktive sèlman sa k klike a
    document.getElementById('tab-' + tabId).classList.add('active');
    element.classList.add('active');
}

// Chaje Done Finans yo
async function chajeFinans() {
    try {
        const { data, error } = await supabase
            .from('peman_fleetht')
            .select('*');
            
        if (error) throw error;
        
        if (data && data.length > 0) {
            let totalPeye = 0;
            let totalDet = 0;
            let chofeSet = new Set();
            
            data.forEach(row => {
                totalPeye += parseFloat(row.montan_peye_htg || 0);
                totalDet += parseFloat(row.reta_det_htg || 0);
                chofeSet.add(row.non_chofe);
            });
            
            // Fòma chif yo ak vigil
            document.getElementById('val-total-peye').innerText = totalPeye.toLocaleString() + ' G';
            document.getElementById('val-total-det').innerText = totalDet.toLocaleString() + ' G';
            document.getElementById('val-chofe').innerText = chofeSet.size;
        }
    } catch (error) {
        console.error('Erè Finans:', error);
    } finally {
        document.getElementById('loading-finans').style.display = 'none';
        document.getElementById('finans-data').style.display = 'block';
    }
}

// Chaje Done Foto yo
async function chajeFlot() {
    try {
        const { data, error } = await supabase
            .from('enspeksyon_fleetht')
            .select('*')
            .order('dat_kreye', { ascending: false });
            
        if (error) throw error;
        
        const container = document.getElementById('flot-data');
        container.innerHTML = '';
        
        if (data && data.length > 0) {
            data.forEach(row => {
                let d = new Date(row.dat_kreye).toLocaleDateString();
                let card = `
                    <div class="ios-card overflow-hidden !p-0">
                        <img src="${row.foto_url}" class="w-full h-48 object-cover" alt="Moto ${row.plak}">
                        <div class="p-4">
                            <h3 class="font-bold text-lg">Plak: ${row.plak}</h3>
                            <p class="text-sm text-gray-500">Dat: ${d}</p>
                            <p class="mt-2 text-sm">${row.not_enspeksyon || 'Okenn nòt'}</p>
                        </div>
                    </div>
                `;
                container.innerHTML += card;
            });
        } else {
            container.innerHTML = '<p class="text-center text-gray-500 py-10">Poko gen foto nan sistèm nan.</p>';
        }
    } catch (error) {
        console.error('Erè Flòt:', error);
    } finally {
        document.getElementById('loading-flot').style.display = 'none';
        document.getElementById('flot-data').style.display = 'block';
    }
}

// Kòmanse chaje lè aplikasyon an louvri
window.onload = () => {
    chajeFinans();
    chajeFlot();
};

import fs from 'fs';

async function test() {
  const fd = new FormData();
  fd.append('userCode', 'USR-67AA7E2A'); // User from logs
  fd.append('latitude', '12.34');
  fd.append('longitude', '56.78');
  
  const buffer = fs.readFileSync('dummy.jpg');
  fd.append('photo', new Blob([buffer], { type: 'image/jpeg' }), 'photo.jpg');
  
  console.log('Hitting Local Server on 5001...');
  try {
    const res = await fetch('http://localhost:5001/api/punchin', {
      method: 'POST',
      body: fd
    });
    console.log('Status:', res.status);
    console.log('Response:', await res.text());
  } catch (err) {
    console.error('Fetch error:', err);
  }
}
test();

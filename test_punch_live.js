async function test() {
  const fd = new FormData();
  fd.append('userCode', 'TEST1234');
  fd.append('latitude', '12.34');
  fd.append('longitude', '56.78');
  fd.append('photo', new Blob(['fake image data'], { type: 'image/jpeg' }), 'photo.jpg');
  
  console.log('Testing Live Server...');
  const res = await fetch('https://query-app-backend-tu3h.onrender.com/api/punchin', {
    method: 'POST',
    body: fd
  });
  console.log('Live Status:', res.status, await res.text());
}
test();

async function test() {
  const fd = new FormData();
  fd.append('userCode', 'TEST1234');
  fd.append('latitude', '12.34');
  fd.append('longitude', '56.78');
  // Add a fake file to bypass the multer file missing error if it's there
  fd.append('photo', new Blob(['fake image data'], { type: 'image/jpeg' }), 'photo.jpg');
  
  const res = await fetch('http://localhost:5000/api/punchin', {
    method: 'POST',
    body: fd
  });
  console.log(res.status, await res.text());
}
test();

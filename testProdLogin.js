const run = async () => {
  const res = await fetch("https://query-app-backend-tu3h.onrender.com/api/user/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mobile: "9999", password: "wrong" })
  });
  console.log("Status:", res.status);
  console.log("Body:", await res.text());
};
run();

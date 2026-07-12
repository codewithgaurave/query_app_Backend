

const run = async () => {
  try {
    // 1. Login to get Admin Token
    console.log("Logging in as superadmin...");
    const loginRes = await fetch("http://localhost:5000/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminId: "superadmin", password: "superadmin123" }),
    });

    const loginData = await loginRes.json();
    if (!loginRes.ok) {
      console.error("Login failed:", loginData);
      return;
    }

    const token = loginData.token;
    console.log("Login successful! Token acquired.");

    // 2. Try to create a user
    console.log("Attempting to create user...");
    const createUserRes = await fetch("http://localhost:5000/api/user/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        mobile: "9999999999",
        password: "userpassword",
        role: "SURVEY_USER",
        fullName: "Test User"
      })
    });

    const createUserData = await createUserRes.json();
    console.log("Create User Response Status:", createUserRes.status);
    console.log("Create User Response Data:", createUserData);

  } catch (err) {
    console.error("Script error:", err);
  }
};

run();

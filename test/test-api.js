const BASE_URL = "http://localhost:3000/api";

const MOCK_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0LXVzZXIiLCJpYXQiOjE3MzM2NzIwMDAsImV4cCI6MTczMzc1ODQwMH0.test-signature";

async function testAPI() {
  console.log("Testing API endpoints...\n");

  console.log("1. Testing upsert user...");
  try {
    const userResponse = await fetch(`${BASE_URL}/users/upsert`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MOCK_JWT}`,
      },
      body: JSON.stringify({
        id: "test-user-123",
        firstName: "Test",
        lastName: "User",
        company: "Test Company",
        role: "user",
        phone: "+1234567890",
        channel: "web",
        billing: 1,
        plan: 1,
        trusted: 1,
      }),
    });

    if (userResponse.ok) {
      const userData = await userResponse.json();
      console.log("- User upsert successful:", userData);
    } else {
      console.log("- User upsert failed:", await userResponse.text());
    }
  } catch (error) {
    console.log("- User upsert error:", error.message);
  }

  console.log("\n2. Testing create comment...");
  try {
    const commentResponse = await fetch(`${BASE_URL}/comments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MOCK_JWT}`,
      },
      body: JSON.stringify({
        cid: "test-content-123",
        vid: "test-video-456",
        uid: "test-user-123",
        comment: "This is a test comment!",
        status: 1,
      }),
    });

    if (commentResponse.ok) {
      const commentData = await commentResponse.json();
      console.log("- Comment creation successful:", commentData);
    } else {
      console.log("- Comment creation failed:", await commentResponse.text());
    }
  } catch (error) {
    console.log("- Comment creation error:", error.message);
  }

  console.log("\n3. Testing get comments...");
  try {
    const getCommentsResponse = await fetch(
      `${BASE_URL}/comments?vid=test-video-456`,
      {
        headers: {
          Authorization: `Bearer ${MOCK_JWT}`,
        },
      }
    );

    if (getCommentsResponse.ok) {
      const commentsData = await getCommentsResponse.json();
      console.log("- Get comments successful:", commentsData);
    } else {
      console.log("- Get comments failed:", await getCommentsResponse.text());
    }
  } catch (error) {
    console.log("- Get comments error:", error.message);
  }

  console.log("\nAPI testing completed!");
}

if (require.main === module) {
  testAPI();
}

module.exports = { testAPI };

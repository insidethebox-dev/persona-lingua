// Test Cloudinary URL access
async function testCloudinaryAccess() {
  const testUrl =
    "https://res.cloudinary.com/ducq89osh/raw/upload/v1759942461/personalingua/1759942460792-1758116602971-GRAM-20Oefening-20indef_imperf-20A2_1.pdf";

  console.log("🌐 Testing Cloudinary URL access...");
  console.log(`URL: ${testUrl}`);

  try {
    const response = await fetch(testUrl, {
      method: "HEAD", // Just check headers
    });

    console.log(`Status: ${response.status}`);
    console.log(`Headers:`);
    for (const [key, value] of response.headers) {
      console.log(`  ${key}: ${value}`);
    }

    if (response.status === 401) {
      console.log("\n❌ 401 Unauthorized - Files might be set to private");
      console.log("💡 Try accessing the file directly in browser to verify");
    } else if (response.status === 200) {
      console.log("\n✅ File is accessible");
    }
  } catch (error) {
    console.error("❌ Fetch error:", error.message);
  }
}

testCloudinaryAccess();

import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, email, category, message } = body;

    if (!email || !message) {
      return NextResponse.json(
        { error: "Email and message are required." },
        { status: 400 }
      );
    }

    // In a production system, this would write to a database or trigger an email service (SES/SendGrid)
    console.log("[Support & Feedback Received]", {
      timestamp: new Date().toISOString(),
      type: type || "question",
      email,
      category: category || "general",
      message,
    });

    return NextResponse.json({
      success: true,
      message:
        type === "feedback"
          ? "Thank you for your valuable feedback! We appreciate your contribution to Bharat Safe Yatra."
          : "Your question has been received! Our support team will respond to your email shortly.",
    });
  } catch (error) {
    console.error("Error processing feedback/question:", error);
    return NextResponse.json(
      { error: "Failed to process your request." },
      { status: 500 }
    );
  }
}

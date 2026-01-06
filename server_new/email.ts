import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function sendBookingEmail(to: string, bookingDetails: any) {
  if (!resend) {
    console.log("Resend API Key not set, skipping email.");
    return;
  }

  try {
    await resend.emails.send({
      from: 'Black Heritage Events <onboarding@resend.dev>',
      to,
      subject: 'Your Ticket Confirmation - Black Heritage Events',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px;">
          <h2 style="color: #FFD700;">Your Ticket is Confirmed!</h2>
          <p>Hi ${bookingDetails.name},</p>
          <p>Thank you for booking with Black Heritage Events & Entertainment. Your ticket details are below:</p>
          <div style="background: #f9f9f9; padding: 15px; border-radius: 8px;">
            <p><strong>Event:</strong> ${bookingDetails.eventTitle}</p>
            <p><strong>Quantity:</strong> ${bookingDetails.quantity}</p>
            <p><strong>Total Paid:</strong> ₦${(bookingDetails.totalAmount / 100).toLocaleString()}</p>
          </div>
          <p style="margin-top: 20px;">See you at the event!</p>
        </div>
      `
    });
  } catch (error) {
    console.error("Failed to send booking email:", error);
  }
}

export async function sendAdminNotification(adminEmail: string, type: 'booking' | 'registration', details: any) {
  if (!resend) return;

  try {
    const subject = type === 'booking' ? 'New Booking Alert' : 'New Organizer Registration';
    const content = type === 'booking' 
      ? `<p>A new booking has been made for <strong>${details.eventTitle}</strong> by ${details.name}.</p>`
      : `<p>A new organizer <strong>${details.username}</strong> has registered.</p>`;

    await resend.emails.send({
      from: 'Black Heritage Events <onboarding@resend.dev>',
      to: adminEmail,
      subject,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px;">
          <h2 style="color: #FFD700;">${subject}</h2>
          ${content}
          <p style="margin-top: 20px;">Check the admin portal for more details.</p>
        </div>
      `
    });
  } catch (error) {
    console.error("Failed to send admin notification:", error);
  }
}

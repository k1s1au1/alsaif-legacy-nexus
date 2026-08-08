import { registerPlugin, Capacitor } from "@capacitor/core";
import { toast } from "sonner";

export interface BiometricAuthPlugin {
  checkBiometry(): Promise<{ isAvailable: boolean }>;
  authenticate(options: { title: string; subtitle: string }): Promise<{ success: boolean }>;
}

export interface FamilySharingPlugin {
  shareInvitation(options: { title: string; date: string; location: string }): Promise<void>;
}

export interface FamilyContactsPlugin {
  saveContact(options: { name: string; phone: string; prefix?: string }): Promise<void>;
}

export interface DocumentScannerPlugin {
  scanDocument(): Promise<{ path: string }>;
}

export interface WidgetPlugin {
  updateData(options: { title?: string; date?: string; label?: string }): Promise<void>;
}

export const DocumentScanner = registerPlugin<DocumentScannerPlugin>("DocumentScanner");
export const Widget = registerPlugin<WidgetPlugin>("Widget");

const FamilySharingRaw = registerPlugin<FamilySharingPlugin>("FamilySharing");
export const FamilyContacts = registerPlugin<FamilyContactsPlugin>("FamilyContacts");

/**
 * Enhanced Sharing: Generates a beautiful image on the fly and shares it.
 */
export const FamilySharing = {
  async shareInvitation({
    title,
    date,
    location,
  }: {
    title: string;
    date: string;
    location: string;
  }) {
    /*
       Royal Update: We now use the Web Canvas implementation for BOTH web and native platforms.
       This ensures the invitation always includes the official Alsaif Logo/Seal and
       the premium ivory-gold design, which is more easily managed via the web bridge.
    */

    // Web Fallback: Generate Canvas Image (Royal Edition)
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 1500; // Taller for better proportions
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 1. Draw Background (Royal Ivory Texture)
    const grad = ctx.createLinearGradient(0, 0, 1200, 1500);
    grad.addColorStop(0, "#FDFCF7"); // Ivory White
    grad.addColorStop(1, "#F2F1EA"); // Off-white
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1200, 1500);

    // 2. Draw Borders (Gold Frame)
    ctx.strokeStyle = "#8E7745"; // Gold
    ctx.lineWidth = 20;
    ctx.strokeRect(40, 40, 1120, 1420);
    ctx.lineWidth = 5;
    ctx.strokeRect(70, 70, 1060, 1360);

    // 3. Load and Draw Logo as a "Seal/Stamp"
    const loadLogo = () => new Promise<HTMLImageElement>((res) => {
      const img = new Image();
      img.src = "/logo-home.png";
      img.onload = () => res(img);
      img.onerror = () => res(new Image()); // Fallback if failed
    });

    const logo = await loadLogo();
    if (logo.width > 0) {
      // Draw watermark logo (Large & Subtle in center)
      ctx.globalAlpha = 0.04;
      ctx.drawImage(logo, 300, 450, 600, 600);
      ctx.globalAlpha = 1.0;

      // Draw official seal logo (Top Center)
      ctx.drawImage(logo, 500, 100, 200, 200);
    }

    // 4. Draw Typography
    ctx.textAlign = "center";
    ctx.fillStyle = "#064E3B"; // Diamond Green
    ctx.font = 'bold 100px "Amiri", serif';
    ctx.fillText("دعوة عائلية", 600, 420);

    // Decorative Line
    ctx.strokeStyle = "#8E7745";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(400, 460);
    ctx.lineTo(800, 460);
    ctx.stroke();

    ctx.fillStyle = "#1A1C1E";
    ctx.font = 'bold 80px "Tajawal", sans-serif';
    ctx.fillText(title, 600, 600);

    // Details Section
    const drawDetail = (label: string, value: string, y: number) => {
      ctx.fillStyle = "#8E7745";
      ctx.font = 'bold 45px "Tajawal", sans-serif';
      ctx.fillText(label, 600, y);
      ctx.fillStyle = "#064E3B";
      ctx.font = 'bold 60px "Tajawal", sans-serif';
      ctx.fillText(value, 600, y + 80);
    };

    drawDetail("📅 الموعد والتاريخ", date, 800);
    drawDetail("📍 الموقع والمكان", location, 1050);

    // Footer - Official Stamp Style
    ctx.fillStyle = "rgba(6, 78, 59, 0.4)";
    ctx.font = 'italic 35px "Amiri", serif';
    ctx.fillText("صُدرت من مجلس عائلة السيف الرقمي", 600, 1350);
    ctx.fillText("نصل العائلة، نحفظ الإرث، ونبني المستقبل", 600, 1410);

    // Share or Download
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], "invitation.png", { type: "image/png" });

      if (navigator.share) {
        try {
          await navigator.share({
            files: [file],
            title: title,
            text: `ندعوكم لحضور: ${title}`,
          });
        } catch (e) {
          toast.error("فشل المشاركة");
        }
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "invitation.png";
        a.click();
        toast.success("تم تحميل بطاقة الدعوة بنجاح");
      }
    });
  },
};

const BiometricAuth = registerPlugin<BiometricAuthPlugin>("BiometricAuth");
export { BiometricAuth };

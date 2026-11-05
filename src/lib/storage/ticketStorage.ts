export interface StoredTicket {
  ticketNumber: string;
  token: string;
  subject: string;
  category?: string;
  domain?: string;
  departmentName?: string;
  locationDetail?: string;
  status?: string;
  createdAt: string;
}

const STORAGE_KEY = "iitgn_resident_saved_tickets";

export function getStoredTickets(): StoredTicket[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("Error reading saved tickets from storage:", e);
    return [];
  }
}

export function saveTicketToStorage(ticket: StoredTicket) {
  if (typeof window === "undefined" || !ticket.ticketNumber || !ticket.token) return;
  try {
    const existing = getStoredTickets();
    const cleanNum = ticket.ticketNumber.trim().toUpperCase();
    // Filter out existing record if any to update with latest info
    const filtered = existing.filter((t) => t.ticketNumber.trim().toUpperCase() !== cleanNum);
    const updated = [
      {
        ...ticket,
        ticketNumber: cleanNum,
      },
      ...filtered,
    ];
    // Keep up to 20 most recent tickets
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated.slice(0, 20)));
  } catch (e) {
    console.error("Error saving ticket to storage:", e);
  }
}

export function getTicketTokenFromStorage(ticketNumber: string): string | null {
  if (typeof window === "undefined" || !ticketNumber) return null;
  try {
    const tickets = getStoredTickets();
    const cleanNum = ticketNumber.trim().toUpperCase();
    const found = tickets.find((t) => t.ticketNumber.trim().toUpperCase() === cleanNum);
    return found ? found.token : null;
  } catch (e) {
    return null;
  }
}

export function removeTicketFromStorage(ticketNumber: string) {
  if (typeof window === "undefined" || !ticketNumber) return;
  try {
    const tickets = getStoredTickets();
    const cleanNum = ticketNumber.trim().toUpperCase();
    const filtered = tickets.filter((t) => t.ticketNumber.trim().toUpperCase() !== cleanNum);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.error("Error removing ticket from storage:", e);
  }
}

export function clearStoredTickets() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error("Error clearing saved tickets from storage:", e);
  }
}


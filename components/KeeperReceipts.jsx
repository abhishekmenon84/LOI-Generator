export default function KeeperReceipts({ receipts }) {
  function formatAmount(cents, currency) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
  }

  function formatDate(iso) {
    return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  }

  if (receipts.length === 0) {
    return <p style={{ color: "var(--text-secondary)" }}>No receipts yet.</p>;
  }

  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
          <th style={{ padding: "8px 4px" }}>Date</th>
          <th style={{ padding: "8px 4px" }}>Amount</th>
          <th style={{ padding: "8px 4px" }}>Status</th>
          <th style={{ padding: "8px 4px" }}></th>
        </tr>
      </thead>
      <tbody>
        {receipts.map((r) => (
          <tr key={r.id} style={{ borderBottom: "1px solid var(--border)" }}>
            <td style={{ padding: "8px 4px" }}>{formatDate(r.createdAt)}</td>
            <td style={{ padding: "8px 4px" }}>{formatAmount(r.amountPaid, r.currency)}</td>
            <td style={{ padding: "8px 4px", textTransform: "capitalize" }}>{r.status}</td>
            <td style={{ padding: "8px 4px" }}>
              {r.hostedInvoiceUrl && (
                <a href={r.hostedInvoiceUrl} target="_blank" rel="noopener noreferrer">
                  View receipt
                </a>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

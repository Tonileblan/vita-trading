// Shared "Paper & Ink" styling for Vita-Trading emails.
export const main = {
  backgroundColor: '#ffffff',
  fontFamily: "Helvetica, Arial, sans-serif",
}

export const container = {
  maxWidth: '560px',
  margin: '0 auto',
  padding: '32px 24px',
}

export const card = {
  backgroundColor: '#F7F4EC',
  border: '1px solid #E2DCCC',
  borderRadius: '10px',
  padding: '32px 28px',
}

export const brand = {
  fontSize: '13px',
  letterSpacing: '3px',
  textTransform: 'uppercase' as const,
  color: '#8A8375',
  margin: '0 0 18px',
  fontWeight: 'bold' as const,
}

export const h1 = {
  fontSize: '26px',
  lineHeight: '1.15',
  letterSpacing: '0.5px',
  textTransform: 'uppercase' as const,
  fontWeight: 'bold' as const,
  color: '#2A2723',
  margin: '0 0 18px',
}

export const text = {
  fontSize: '15px',
  color: '#4A463F',
  lineHeight: '1.6',
  margin: '0 0 22px',
}

export const link = { color: '#2A2723', textDecoration: 'underline' }

export const button = {
  display: 'inline-block',
  backgroundColor: '#2A2723',
  color: '#F7F4EC',
  fontSize: '14px',
  fontWeight: 'bold' as const,
  letterSpacing: '1px',
  textTransform: 'uppercase' as const,
  borderRadius: '8px',
  padding: '14px 26px',
  textDecoration: 'none',
}

export const code = {
  display: 'inline-block',
  fontFamily: 'Courier New, monospace',
  fontSize: '30px',
  letterSpacing: '8px',
  color: '#2A2723',
  backgroundColor: '#ffffff',
  border: '1px dashed #C9C1AC',
  borderRadius: '8px',
  padding: '14px 20px',
  margin: '0 0 22px',
}

export const hr = {
  border: 'none',
  borderTop: '1px solid #E2DCCC',
  margin: '28px 0 18px',
}

export const footer = {
  fontSize: '12px',
  color: '#8A8375',
  lineHeight: '1.6',
  margin: '0',
}

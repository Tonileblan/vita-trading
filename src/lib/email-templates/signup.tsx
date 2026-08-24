import * as React from 'react'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'

import { brand, button, card, container, footer, h1, hr, link, main, text } from './theme'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>¡Bienvenido a {siteName}! Confirma tu correo para empezar</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={card}>
          <Text style={brand}>{siteName}</Text>
          <Heading style={h1}>¡Te damos la bienvenida!</Heading>
          <Text style={text}>
            ¡Hola! Qué alegría tenerte por aquí. Muchas gracias por unirte a{' '}
            <Link href={siteUrl} style={link}>
              <strong>{siteName}</strong>
            </Link>
            .
          </Text>
          <Text style={text}>
            Estás a un solo paso de activar tu bitácora de trading, registrar tus operaciones con total detalle y llevar el control diario de tus cuentas y drawdown.
          </Text>
          <Text style={text}>
            Para verificar tu dirección de correo (<strong>{recipient}</strong>) y dejar tu cuenta lista, solo tienes que pulsar el siguiente botón:
          </Text>
          <div style={{ textAlign: 'center', margin: '26px 0' }}>
            <Button style={button} href={confirmationUrl}>
              Activar mi cuenta y empezar 🚀
            </Button>
          </div>
          <Text style={{ ...text, fontSize: '13px', color: '#6A655C' }}>
            Si el botón no te funciona, puedes abrir este enlace directamente en tu navegador:
            <br />
            <Link href={confirmationUrl} style={{ ...link, wordBreak: 'break-all', fontSize: '12px' }}>
              {confirmationUrl}
            </Link>
          </Text>
          <Text style={{ ...text, marginTop: '20px', marginBottom: '4px' }}>
            ¡Te deseamos el mayor de los éxitos en tu operativa!
          </Text>
          <Text style={{ ...text, fontWeight: 'bold', color: '#2A2723', margin: '0 0 20px' }}>
            Toni y el equipo de {siteName}
          </Text>
          <Hr style={hr} />
          <Text style={footer}>
            Si tú no has solicitado el registro en {siteName}, no te preocupes: puedes ignorar este mensaje y no se creará ninguna cuenta.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

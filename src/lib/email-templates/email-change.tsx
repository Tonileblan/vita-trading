import * as React from 'react'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'

import { brand, button, card, container, footer, h1, hr, main, text } from './theme'

interface EmailChangeEmailProps {
  siteName: string
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  oldEmail,
  email,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>Confirma tu nueva dirección de correo en {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={card}>
          <Text style={brand}>{siteName}</Text>
          <Heading style={h1}>Confirma tu nuevo correo</Heading>
          <Text style={text}>
            Has solicitado cambiar el correo de tu cuenta de{' '}
            <strong>{oldEmail || email}</strong> a <strong>{newEmail || email}</strong>.
            Confirma el cambio para que sea efectivo.
          </Text>
          <Button style={button} href={confirmationUrl}>
            Confirmar cambio
          </Button>
          <Hr style={hr} />
          <Text style={footer}>
            Si no has solicitado este cambio, ignora este correo y tu dirección
            actual se mantendrá.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail

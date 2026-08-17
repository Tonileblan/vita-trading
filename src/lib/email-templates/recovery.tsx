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

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({ siteName, confirmationUrl }: RecoveryEmailProps) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>Restablece tu contraseña de {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={card}>
          <Text style={brand}>{siteName}</Text>
          <Heading style={h1}>Restablecer contraseña</Heading>
          <Text style={text}>
            Hemos recibido una solicitud para restablecer la contraseña de tu
            cuenta en {siteName}. Pulsa el botón para elegir una nueva.
          </Text>
          <Button style={button} href={confirmationUrl}>
            Crear nueva contraseña
          </Button>
          <Hr style={hr} />
          <Text style={footer}>
            Si no has solicitado el cambio, ignora este correo: tu contraseña
            seguirá siendo la misma.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

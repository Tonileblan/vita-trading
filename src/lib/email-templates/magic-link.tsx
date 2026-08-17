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

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({ siteName, confirmationUrl }: MagicLinkEmailProps) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>Tu enlace de acceso a {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={card}>
          <Text style={brand}>{siteName}</Text>
          <Heading style={h1}>Entrar en tu bitácora</Heading>
          <Text style={text}>
            Pulsa el botón para iniciar sesión en {siteName}. El enlace caduca en
            poco tiempo y solo puede usarse una vez.
          </Text>
          <Button style={button} href={confirmationUrl}>
            Iniciar sesión
          </Button>
          <Hr style={hr} />
          <Text style={footer}>
            Si no has pedido este enlace, ignora este correo.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

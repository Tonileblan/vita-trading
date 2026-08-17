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
    <Preview>Confirma tu correo para empezar en {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={card}>
          <Text style={brand}>{siteName}</Text>
          <Heading style={h1}>Confirma tu correo</Heading>
          <Text style={text}>
            Gracias por crear tu cuenta en{' '}
            <Link href={siteUrl} style={link}>
              <strong>{siteName}</strong>
            </Link>
            . Confirma la dirección <strong>{recipient}</strong> para activar tu
            bitácora de trading.
          </Text>
          <Button style={button} href={confirmationUrl}>
            Confirmar correo
          </Button>
          <Hr style={hr} />
          <Text style={footer}>
            Si no has creado ninguna cuenta, puedes ignorar este mensaje.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

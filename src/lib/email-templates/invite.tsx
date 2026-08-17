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

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({ siteName, siteUrl, confirmationUrl }: InviteEmailProps) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>Te han invitado a {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={card}>
          <Text style={brand}>{siteName}</Text>
          <Heading style={h1}>Tienes una invitación</Heading>
          <Text style={text}>
            Te han invitado a unirte a{' '}
            <Link href={siteUrl} style={link}>
              <strong>{siteName}</strong>
            </Link>
            , la bitácora para registrar y analizar tus operaciones. Acepta la
            invitación para crear tu cuenta.
          </Text>
          <Button style={button} href={confirmationUrl}>
            Aceptar invitación
          </Button>
          <Hr style={hr} />
          <Text style={footer}>
            Si no esperabas esta invitación, puedes ignorar este correo.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail

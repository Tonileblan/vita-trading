import * as React from 'react'

import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'

import { brand, card, code, container, footer, h1, hr, main, text } from './theme'

interface ReauthenticationEmailProps {
  token: string
  siteName?: string
}

export const ReauthenticationEmail = ({
  token,
  siteName = 'Vita-Trading',
}: ReauthenticationEmailProps) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>Tu código de verificación</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={card}>
          <Text style={brand}>{siteName}</Text>
          <Heading style={h1}>Código de verificación</Heading>
          <Text style={text}>
            Introduce este código para confirmar la operación en tu cuenta:
          </Text>
          <Text style={code}>{token}</Text>
          <Hr style={hr} />
          <Text style={footer}>
            Si no has solicitado este código, ignora este correo.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

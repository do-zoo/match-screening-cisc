import { Row } from 'react-email'
import type { CSSProperties, Key, ReactElement, ReactNode } from 'react'

type EmailRowProps = {
  key?: Key
  style?: CSSProperties
}

/** Row wrapper — JSX avoids react/no-children-prop vs createElement overload conflicts. */
export function emailRow(props: EmailRowProps, ...children: ReactNode[]): ReactElement {
  return (
    <Row key={props.key} style={props.style}>
      {children}
    </Row>
  )
}

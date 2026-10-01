import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('frontend app', () => {
  it('renders the home screen', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Get started' })).toBeTruthy()
  })
})

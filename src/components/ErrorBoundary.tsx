import { Component, type ReactNode } from 'react'
import { Empty } from './Cards'
export default class ErrorBoundary extends Component<{ children: ReactNode }, { err: boolean }> {
  state = { err: false }
  static getDerivedStateFromError() { return { err: true } }
  render() { return this.state.err ? <Empty t="Something went quiet" b="This page hit an error. Try another tab, or reload." /> : this.props.children }
}

import { render } from 'preact';
import { Analysis } from './Analysis';
import '../ui/styles.css';

const params = new URLSearchParams(location.search);
const chain = (params.get('chain') ?? 'eth') as any;
const address = params.get('address') ?? '';

render(<Analysis chain={chain} address={address} />, document.getElementById('app')!);

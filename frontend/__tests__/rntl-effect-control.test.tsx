import React, { useEffect } from 'react';
import { View } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';

describe('RNTL passive effect control', () => {
  it('runs a passive effect for a null consumer', async () => {
    const effect = jest.fn();
    function NullConsumer() { useEffect(effect, []); return null; }
    render(<NullConsumer />);
    await waitFor(() => expect(effect).toHaveBeenCalledTimes(1));
  });

  it('runs a passive effect for a host consumer', async () => {
    const effect = jest.fn();
    function HostConsumer() { useEffect(effect, []); return <View testID="consumer" />; }
    render(<HostConsumer />);
    await waitFor(() => expect(effect).toHaveBeenCalledTimes(1));
  });
});

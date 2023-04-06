import { get } from 'svelte/store'
import { _ } from 'svelte-i18n'
import defaultCopy from './i18n/en.json'
import type { EthereumTransactionData } from 'bnc-sdk'

import type {
  CustomNotification,
  Notification,
  NotificationType
} from './types.js'

import { validateTransactionHandlerReturn } from './validation.js'
import { state } from './store/index.js'
import { addNotification } from './store/actions.js'
import updateBalances from './update-balances.js'
import { updateTransaction } from './streams.js'

export function handleTransactionUpdates(
  transaction: EthereumTransactionData
): void {
  const customized = state.get().notify.transactionHandler(transaction)
  const invalid = validateTransactionHandlerReturn(customized)

  if (invalid) {
    throw invalid
  }

  if (transaction.eventCode === 'txConfirmed') {
    updateBalances([transaction.watchedAddress, transaction.counterparty])
  }

  const notification = transactionEventToNotification(transaction, customized)

  addNotification(notification)
  updateTransaction(transaction)
}

export function transactionEventToNotification(
  transaction: EthereumTransactionData,
  customization: CustomNotification | boolean | void
): Notification {
  const {
    id,
    hash,
    startTime,
    eventCode,
    direction,
    counterparty,
    value,
    asset,
    network
  } = transaction

  const type: NotificationType = eventToType(eventCode)

  const key = `${id || hash}-${
    (typeof customization === 'object' && customization.eventCode) || eventCode
  }`

  const counterpartyShortened: string | undefined =
    counterparty &&
    counterparty.substring(0, 4) +
      '...' +
      counterparty.substring(counterparty.length - 4)
console.log(value)
  const valueBigInt = BigInt(value || 0)
  const divisor = 1000000000000000000n
  console.log(valueBigInt, divisor, valueBigInt / divisor)
  const formattedValue = (Number(valueBigInt) / Number(divisor)).toString(10)
console.log(formattedValue)
  const formatterOptions =
    counterparty && value
      ? {
          messageId: `notify.watched['${eventCode}']`,
          values: {
            verb:
              eventCode === 'txConfirmed'
                ? direction === 'incoming'
                  ? 'received'
                  : 'sent'
                : direction === 'incoming'
                ? 'receiving'
                : 'sending',
            formattedValue,
            preposition: direction === 'incoming' ? 'from' : 'to',
            counterpartyShortened,
            asset
          }
        }
      : {
          messageId: `notify.transaction['${eventCode}']`,
          values: { formattedValue, asset }
        }

  const formatter = get(_)

  const notificationDefaultMessages = defaultCopy.notify

  const typeKey: keyof typeof notificationDefaultMessages = counterparty
    ? 'watched'
    : 'transaction'

  const notificationMessageType = notificationDefaultMessages[typeKey]

  const defaultMessage =
    notificationMessageType[eventCode as keyof typeof notificationMessageType]

  const message = formatter(formatterOptions.messageId, {
    values: formatterOptions.values,
    default: defaultMessage
  })

  let notification = {
    id: id || hash,
    type,
    key,
    network,
    startTime: startTime || Date.now(),
    eventCode,
    message,
    autoDismiss: typeToDismissTimeout(
      (typeof customization === 'object' && customization.type) || type
    )
  }

  if (typeof customization === 'object') {
    notification = { ...notification, ...customization }
  }

  return notification
}

export function eventToType(eventCode: string | undefined): NotificationType {
  switch (eventCode) {
    case 'txSent':
    case 'txPool':
      return 'pending'
    case 'txSpeedUp':
    case 'txCancel':
    case 'txRequest':
    case 'txRepeat':
    case 'txAwaitingApproval':
    case 'txConfirmReminder':
    case 'txStuck':
      return 'hint'
    case 'txError':
    case 'txSendFail':
    case 'txFailed':
    case 'txDropped':
    case 'nsfFail':
    case 'txUnderpriced':
      return 'error'
    case 'txConfirmed':
      return 'success'
    default:
      return 'hint'
  }
}

export function typeToDismissTimeout(type: string): number {
  switch (type) {
    case 'success':
    case 'hint':
      return 4000
    default:
      return 0
  }
}
